use axum::{
    extract::{State, Json, Path, Query},
    http::{StatusCode, Method, HeaderMap},
    routing::{get, post, delete},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{AnyPool, any::AnyPoolOptions};
use sqlx::migrate::MigrateDatabase;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber;
use utoipa::{OpenApi, ToSchema, IntoParams};
use utoipa_swagger_ui::SwaggerUi;
use utoipa::openapi::security::{SecurityScheme, HttpAuthScheme, Http};
use sqlx::Row;

#[derive(OpenApi)]
#[openapi(
    paths(
        health_check,
        submit_game,
        get_games,
        get_stats,
        get_team_leaderboard,
        get_player_stats,
        get_team_stats
    ),
    components(
        schemas(
            BullseyePayload, BullseyeData, BullseyeState, GameOptions, MovementOptions, 
            Round, Panorama, Player, Guess, Score, BoundingBox, LatLng,
            GameSummary, GameStats, CountryStat, TeamStats, PlayerStatsDetailed, TeamStatSimple, ScorePoint, TeamStatsDetailed
        )
    ),
    tags(
        (name = "bullseye-tracker", description = "Bullseye Game Tracker API")
    ),
    modifiers(&SecurityAddon)
)]
struct ApiDoc;

struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "api_key",
                SecurityScheme::Http(
                    Http::new(HttpAuthScheme::Bearer)
                ),
            )
        }
    }
}

#[tokio::main]
async fn main() {
    // Install default drivers for AnyPool
    sqlx::any::install_default_drivers();

    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Load .env
    dotenv::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://bullseye.db?mode=rwc".to_string());

    println!("Using database: {}", database_url);

    // Create DB pool using AnyPool to support both Postgres and SQLite
    // For SQLite, we might need to create the DB file first if it doesn't exist
    if database_url.starts_with("sqlite://") {
        if !sqlx::Sqlite::database_exists(&database_url).await.unwrap_or(false) {
            println!("Creating database {}", database_url);
            sqlx::Sqlite::create_database(&database_url).await.unwrap();
        }
    }

    let pool = AnyPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to DB");

    // Run migrations
    println!("Running migrations...");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");
    println!("Migrations run successfully");
    
    // Simple table creation for SQLite if migration fails or just to ensure it exists
    // This is a quick hack for the dual support without complex migration logic
    let create_table_query = r#"
    CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(255),
        map_name VARCHAR(255),
        score INTEGER,
        round_time INTEGER,
        total_duration INTEGER,
        played_at TEXT DEFAULT CURRENT_TIMESTAMP,
        data TEXT
    );
    "#;
    
    // Adjust for SQLite (AUTOINCREMENT instead of SERIAL)
    let query = if database_url.starts_with("sqlite://") {
        create_table_query.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
    } else {
        create_table_query.to_string()
    };

    sqlx::query(&query).execute(&pool).await.ok();

    // Setup CORS
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::DELETE])
        .allow_origin(Any)
        .allow_headers(Any);

    // Build app
    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/", get(health_check))
        .route("/api/submit-game", post(submit_game))
        .route("/api/games", get(get_games))
        .route("/api/stats", get(get_stats))
        .route("/api/leaderboard/teams", get(get_team_leaderboard))
        .route("/api/players/:id/stats", get(get_player_stats))
        .route("/api/teams/:id/stats", get(get_team_stats))
        .route("/api/games/:id", delete(delete_game))
    .route("/api/admin/players", get(get_admin_players))
    .route("/api/admin/link", post(link_player))
    .route("/api/admin/unlink", post(unlink_player))
        .layer(cors)
        .with_state(pool);

    // Run server
    let addr = "0.0.0.0:3000";
    println!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[utoipa::path(
    get,
    path = "/",
    responses(
        (status = 200, description = "Health check passed", body = String)
    )
)]
async fn health_check() -> &'static str {
    "OK"
}

// ... (struct definitions omitted for brevity, they are unchanged)



#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct BullseyePayload {
    code: Option<String>,
    #[serde(rename = "gameId")]
    game_id: Option<String>,
    #[serde(rename = "playerId")]
    player_id: Option<String>,
    payload: Option<serde_json::Value>,
    timestamp: Option<String>,
    lobby: Option<serde_json::Value>,
    #[serde(rename = "countryGuess")]
    country_guess: Option<serde_json::Value>,
    #[serde(rename = "coordinateGuess")]
    coordinate_guess: Option<serde_json::Value>,
    #[serde(rename = "battleRoyaleGameState")]
    battle_royale_game_state: Option<serde_json::Value>,
    #[serde(rename = "battleRoyalePlayer")]
    battle_royale_player: Option<serde_json::Value>,
    duel: Option<serde_json::Value>,
    bullseye: Option<BullseyeData>,
    #[serde(rename = "liveChallenge")]
    live_challenge: Option<serde_json::Value>,
    #[serde(rename = "totalDuration")]
    total_duration: Option<i32>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct BullseyeData {
    state: Option<BullseyeState>,
    guess: Option<Guess>,
    location: Option<serde_json::Value>,
    #[serde(rename = "recipientPlayerId")]
    recipient_player_id: Option<String>,
    #[serde(rename = "playerId")]
    player_id: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct BullseyeState {
    #[serde(rename = "gameId")]
    game_id: Option<String>,
    status: Option<String>,
    options: Option<GameOptions>,
    version: Option<i32>,
    #[serde(rename = "currentRoundNumber")]
    current_round_number: Option<i32>,
    rounds: Option<Vec<Round>>,
    players: Option<Vec<Player>>,
    #[serde(rename = "boundingBox")]
    bounding_box: Option<BoundingBox>,
    #[serde(rename = "hostPlayerId")]
    host_player_id: Option<String>,
    #[serde(rename = "mapName")]
    map_name: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct GameOptions {
    #[serde(rename = "movementOptions")]
    movement_options: Option<MovementOptions>,
    #[serde(rename = "roundCount")]
    round_count: Option<i32>,
    #[serde(rename = "mapSlug")]
    map_slug: Option<String>,
    #[serde(rename = "roundTime")]
    round_time: Option<i32>,
    #[serde(rename = "guessMapType")]
    guess_map_type: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct MovementOptions {
    #[serde(rename = "forbidMoving")]
    forbid_moving: Option<bool>,
    #[serde(rename = "forbidZooming")]
    forbid_zooming: Option<bool>,
    #[serde(rename = "forbidRotating")]
    forbid_rotating: Option<bool>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct Round {
    #[serde(rename = "roundNumber")]
    round_number: Option<i32>,
    panorama: Option<Panorama>,
    #[serde(rename = "startTime")]
    start_time: Option<String>,
    #[serde(rename = "endTime")]
    end_time: Option<String>,
    state: Option<String>,
    score: Option<Score>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct Panorama {
    #[serde(rename = "panoId")]
    pano_id: Option<String>,
    lat: Option<f64>,
    lng: Option<f64>,
    #[serde(rename = "countryCode")]
    country_code: Option<String>,
    heading: Option<f64>,
    pitch: Option<f64>,
    zoom: Option<f64>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct Player {
    #[serde(rename = "playerId")]
    player_id: Option<String>,
    nick: Option<String>,
    guesses: Option<Vec<Guess>>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct Guess {
    #[serde(rename = "roundNumber")]
    round_number: Option<i32>,
    lat: Option<f64>,
    lng: Option<f64>,
    size: Option<i32>,
    #[serde(rename = "isDraft")]
    is_draft: Option<bool>,
    score: Option<Score>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct Score {
    #[serde(rename = "isAnswerWithinRadius")]
    is_answer_within_radius: Option<bool>,
    points: Option<i32>,
    #[serde(rename = "maxPoints")]
    max_points: Option<i32>,
    distance: Option<f64>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct BoundingBox {
    min: Option<LatLng>,
    max: Option<LatLng>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct LatLng {
    lat: Option<f64>,
    lng: Option<f64>,
}

#[utoipa::path(
    post,
    path = "/api/submit-game",
    request_body = BullseyePayload,
    responses(
        (status = 200, description = "Game submitted successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("api_key" = [])
    )
)]
async fn submit_game(
    State(pool): State<AnyPool>,
    headers: HeaderMap,
    Json(payload): Json<BullseyePayload>,
) -> Result<StatusCode, StatusCode> {
    // Check API Key
    if let Ok(env_api_key) = std::env::var("API_KEY") {
        let auth_header = headers.get("Authorization")
            .and_then(|h| h.to_str().ok());
        
        let expected_token = format!("Bearer {}", env_api_key);
        
        if auth_header != Some(&expected_token) {
            println!("Unauthorized access attempt");
            return Err(StatusCode::UNAUTHORIZED);
        }
    }

    println!("Received game payload: {:?}", payload);

    let data_json = serde_json::to_string(&payload).unwrap();

    // Extract fields safely
    let game_id = payload.game_id.as_deref()
        .or_else(|| payload.bullseye.as_ref().and_then(|b| b.state.as_ref().and_then(|s| s.game_id.as_deref())));
    
    let map_name = payload.bullseye.as_ref()
        .and_then(|b| b.state.as_ref())
        .and_then(|s| s.map_name.as_deref());

    let mut score = payload.bullseye.as_ref()
        .and_then(|b| b.guess.as_ref())
        .and_then(|g| g.score.as_ref())
        .and_then(|s| s.points)
        .unwrap_or(0);

    // If score is 0, try to calculate it from rounds in state
    if score == 0 {
        if let Some(rounds) = payload.bullseye.as_ref()
            .and_then(|b| b.state.as_ref())
            .and_then(|s| s.rounds.as_ref()) 
        {
            let calculated_score: i32 = rounds.iter()
                .filter_map(|r| r.score.as_ref().and_then(|s| s.points))
                .sum();
            
            if calculated_score > 0 {
                println!("Calculated score from rounds: {}", calculated_score);
                score = calculated_score;
            }
        }
    }

    let round_time = payload.bullseye.as_ref()
        .and_then(|b| b.state.as_ref())
        .and_then(|s| s.options.as_ref())
        .and_then(|o| o.round_time);

    let total_duration = payload.total_duration;

    let mut played_at = payload.timestamp.clone();

    if played_at.is_none() {
        if let Some(rounds) = payload.bullseye.as_ref()
            .and_then(|b| b.state.as_ref())
            .and_then(|s| s.rounds.as_ref()) 
        {
            // Try to find round 1
            if let Some(first_round) = rounds.iter().find(|r| r.round_number == Some(1)) {
                 played_at = first_round.start_time.clone();
            } else if let Some(first) = rounds.first() {
                 // Fallback to first available round if round 1 not found
                 played_at = first.start_time.clone();
            }
        }
    }

    // Insert game
    sqlx::query(
        "INSERT INTO games (game_id, map_name, score, round_time, total_duration, data, played_at) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP))"
    )
    .bind(game_id)
    .bind(map_name)
    .bind(score)
    .bind(round_time)
    .bind(total_duration)
    .bind(data_json)
    .bind(played_at)
    .execute(&pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Upsert Players
    if let Some(players) = payload.bullseye.as_ref().and_then(|b| b.state.as_ref()).and_then(|s| s.players.as_ref()) {
        for player in players {
            if let (Some(id), Some(nick)) = (&player.player_id, &player.nick) {
                let _ = sqlx::query(
                    "INSERT INTO players (id, name, last_seen) VALUES ($1, $2, CURRENT_TIMESTAMP) 
                     ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_seen = CURRENT_TIMESTAMP"
                )
                .bind(id)
                .bind(nick)
                .execute(&pool)
                .await;
            }
        }
    }

    Ok(StatusCode::OK)
}

#[derive(Serialize, ToSchema, Clone)]
pub struct PlayerInfo {
    id: String,
    name: String,
}

#[derive(Serialize, ToSchema)]
pub struct GameSummary {
    id: i64,
    game_id: Option<String>,
    map_name: Option<String>,
    score: Option<i64>,
    round_time: Option<i64>,
    total_duration: Option<i64>,
    played_at: String,
    players: Vec<PlayerInfo>,
    country_codes: Vec<String>,
    round_count: i64,
    max_score: i64,
    is_finished: bool,
}

#[utoipa::path(
    get,
    path = "/api/games",
    responses(
        (status = 200, description = "List of games", body = Vec<GameSummary>)
    )
)]
async fn get_games(State(pool): State<AnyPool>) -> Json<Vec<GameSummary>> {
    let rows = sqlx::query(
        "SELECT id, game_id, map_name, score, round_time, total_duration, played_at, data FROM games ORDER BY played_at DESC"
    )
    .fetch_all(&pool)
    .await;

    let rows = match rows {
        Ok(r) => {
            println!("Fetched {} games from DB", r.len());
            r
        },
        Err(e) => {
            eprintln!("Failed to fetch games: {}", e);
            return Json(Vec::new());
        }
    };

    // Fetch all known players for name resolution
    let mut known_players: std::collections::HashMap<String, String> = sqlx::query("SELECT id, name FROM players")
        .fetch_all(&pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|row| (row.get("id"), row.get("name")))
        .collect();

    let mut games: Vec<GameSummary> = Vec::new();

    for row in rows {
        let mut players: Vec<PlayerInfo> = Vec::new();
        let mut country_codes = Vec::new();
        let mut round_count: i64 = 0;
        let mut is_finished = false;
        let mut played_at: String = row.try_get("played_at").unwrap_or_default();

        let data_str: Option<String> = row.get("data");
        if let Some(data_str) = data_str {
            if let Ok(payload) = serde_json::from_str::<BullseyePayload>(&data_str) {
                if let Some(state) = payload.bullseye.as_ref().and_then(|b| b.state.as_ref()) {
                    // Extract Players
                    if let Some(p_list) = &state.players {
                        players = p_list.iter().map(|p| {
                            let id = p.player_id.clone().unwrap_or_default();
                            let nick_in_payload = p.nick.clone();

                            // Update known_players if we have a new nick
                            if let Some(n) = &nick_in_payload {
                                known_players.insert(id.clone(), n.clone());
                            }

                            // Try to get name from payload, then directory (which includes what we just learned), then fallback to ID
                            let name = nick_in_payload
                                .or_else(|| known_players.get(&id).cloned())
                                .or_else(|| Some(id.clone()))
                                .unwrap_or_else(|| "Unknown".to_string());
                            
                            PlayerInfo { id, name }
                        }).collect();
                    }
                    
                    // Extract Country Codes (Flags)
                    if let Some(rounds) = &state.rounds {
                        round_count = rounds.len() as i64;
                        for round in rounds {
                            if let Some(cc) = round.panorama.as_ref().and_then(|p| p.country_code.as_ref()) {
                                country_codes.push(cc.clone());
                            }
                        }
                    }

                    // Check Status
                    if let Some(status) = &state.status {
                        is_finished = status.eq_ignore_ascii_case("finished");
                    }

                    // Extract real played_at from rounds
                    if let Some(rounds) = &state.rounds {
                        if let Some(first_round) = rounds.iter().find(|r| r.round_number == Some(1)) {
                             if let Some(start) = &first_round.start_time {
                                 played_at = start.clone();
                             }
                        } else if let Some(first) = rounds.first() {
                             if let Some(start) = &first.start_time {
                                 played_at = start.clone();
                             }
                        }
                    }
                }
            }
        }

        let id: i64 = match row.try_get("id") {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Error getting id: {}", e);
                0
            }
        };
        let game_id: Option<String> = row.try_get("game_id").unwrap_or_default();
        let map_name: Option<String> = row.try_get("map_name").unwrap_or_default();
        let score: Option<i64> = row.try_get("score").unwrap_or_default();
        let round_time: Option<i64> = row.try_get("round_time").unwrap_or_default();
        let total_duration: Option<i64> = row.try_get("total_duration").unwrap_or_default();
        // played_at is already set (either from DB or overridden by JSON)

        games.push(GameSummary {
            id,
            game_id,
            map_name,
            score,
            round_time,
            round_count, // Calculated above
            total_duration,
            played_at,
            players,
            country_codes,
            max_score: round_count * 5000,
            is_finished,
        });
    }

    Json(games)
}

#[utoipa::path(
    delete,
    path = "/api/games/{id}",
    params(
        ("id" = i64, Path, description = "Game ID")
    ),
    responses(
        (status = 200, description = "Game deleted"),
        (status = 404, description = "Game not found")
    )
)]
async fn delete_game(
    Path(id): Path<i64>,
    State(pool): State<AnyPool>
) -> StatusCode {
    let result = sqlx::query("DELETE FROM games WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await;
    
    match result {
        Ok(r) => if r.rows_affected() > 0 { StatusCode::OK } else { StatusCode::NOT_FOUND },
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR
    }
}

#[derive(Serialize, ToSchema)]
struct GameStats {
    total_games: i64,
    average_score: f64,
    total_duration_seconds: i64,
    best_country_guesses: Vec<CountryStat>,
}

#[derive(Serialize, ToSchema, Clone)]
pub struct CountryStat {
    country_code: String,
    total_score: i32,
    count: i32,
    average: f64,
}

#[utoipa::path(
    get,
    path = "/api/stats",
    responses(
        (status = 200, description = "Aggregated statistics", body = GameStats)
    )
)]
async fn get_stats(State(pool): State<AnyPool>) -> Json<GameStats> {
    // Basic stats
    let row = sqlx::query(
        "SELECT COUNT(*) as count, AVG(score) as avg_score, SUM(total_duration) as sum_duration FROM games"
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    let total_games: i64 = row.try_get("count").unwrap_or(0);
    let average_score: f64 = row.try_get("avg_score").unwrap_or(0.0);
    let total_duration_seconds: i64 = row.try_get("sum_duration").unwrap_or(0);

    // Advanced stats (Best Country Guesses)
    let rows = sqlx::query("SELECT data FROM games").fetch_all(&pool).await.unwrap_or_default();

    let mut country_stats: std::collections::HashMap<String, (i32, i32)> = std::collections::HashMap::new();

    for row in rows {
        let data_str: Option<String> = row.get("data");
        if let Some(data_str) = data_str {
            if let Ok(payload) = serde_json::from_str::<BullseyePayload>(&data_str) {
                if let Some(rounds) = payload.bullseye.as_ref()
                    .and_then(|b| b.state.as_ref())
                    .and_then(|s| s.rounds.as_ref()) 
                {
                    for round in rounds {
                        if let Some(cc) = round.panorama.as_ref().and_then(|p| p.country_code.as_ref()) {
                            let points = round.score.as_ref().and_then(|s| s.points).unwrap_or(0);
                            let entry = country_stats.entry(cc.to_lowercase()).or_insert((0, 0));
                            entry.0 += points;
                            entry.1 += 1;
                        }
                    }
                }
            }
        }
    }

    let mut best_countries: Vec<CountryStat> = country_stats.into_iter().map(|(code, (total, count))| {
        CountryStat {
            country_code: code,
            total_score: total,
            count,
            average: if count > 0 { total as f64 / count as f64 } else { 0.0 },
        }
    }).collect();

    // Sort by average score descending
    best_countries.sort_by(|a, b| b.average.partial_cmp(&a.average).unwrap_or(std::cmp::Ordering::Equal));
    best_countries.truncate(10); // Top 10

    Json(GameStats {
        total_games,
        average_score,
        total_duration_seconds,
        best_country_guesses: best_countries,
    })
}

#[derive(Serialize, ToSchema)]
struct TeamStats {
    team_name: String, // Comma separated player names
    members: Vec<PlayerInfo>,
    games_played: i32,
    average_score: f64,
    total_score: i32,
    total_duration: i64,
}

#[utoipa::path(
    get,
    path = "/api/leaderboard/teams",
    params(
        StatsQuery
    ),
    responses(
        (status = 200, description = "Team Leaderboard", body = Vec<TeamStats>)
    )
)]
async fn get_team_leaderboard(
    Query(params): Query<StatsQuery>,
    State(pool): State<AnyPool>
) -> Json<Vec<TeamStats>> {
    // 1. Fetch Alias Map
    let aliases = sqlx::query("SELECT alias_id, primary_id FROM player_aliases")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    let mut alias_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for row in aliases {
        let alias_id: String = row.get("alias_id");
        let primary_id: String = row.get("primary_id");
        alias_map.insert(alias_id, primary_id);
    }

    // Fetch known players for name resolution
    let mut known_players: std::collections::HashMap<String, String> = sqlx::query("SELECT id, name FROM players")
        .fetch_all(&pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|row| (row.get("id"), row.get("name")))
        .collect();

    let rows = sqlx::query("SELECT data FROM games").fetch_all(&pool).await.unwrap_or_default();

    // Map of Sorted Player IDs -> (Members, Total Score, Count, Total Duration)
    let mut team_stats: std::collections::HashMap<String, (Vec<PlayerInfo>, i32, i32, i64)> = std::collections::HashMap::new();

    for row in rows {
        let data_str: Option<String> = row.get("data");
        if let Some(data_str) = data_str {
            if let Ok(payload) = serde_json::from_str::<BullseyePayload>(&data_str) {
                if let Some(state) = payload.bullseye.as_ref().and_then(|b| b.state.as_ref()) {
                    
                    // Learn names
                    if let Some(players) = &state.players {
                        for p in players {
                            if let (Some(pid), Some(nick)) = (&p.player_id, &p.nick) {
                                known_players.insert(pid.clone(), nick.clone());
                            }
                        }
                    }

                    // Filter Abandons
                    let is_finished = state.status.as_deref().map(|s| s.eq_ignore_ascii_case("finished")).unwrap_or(false);
                    if params.exclude_abandons == Some(true) && !is_finished {
                        continue;
                    }

                    if let Some(players) = &state.players {
                        if !players.is_empty() {
                            // Extract player info and resolve to Primary IDs
                            let mut current_team_players: Vec<PlayerInfo> = players.iter().map(|p| {
                                let pid = p.player_id.clone().unwrap_or_default();
                                let primary_id = alias_map.get(&pid).cloned().unwrap_or(pid.clone());
                                
                                let name = known_players.get(&primary_id).cloned()
                                    .or_else(|| known_players.get(&pid).cloned())
                                    .or_else(|| p.nick.clone())
                                    .unwrap_or_else(|| "Unknown".to_string());

                                PlayerInfo {
                                    id: primary_id,
                                    name
                                }
                            }).collect();

                            // Sort by Player ID to ensure consistent team key
                            current_team_players.sort_by(|a, b| a.id.cmp(&b.id));
                            // Deduplicate (in case alias + primary were in same game?)
                            current_team_players.dedup_by(|a, b| a.id == b.id);

                            let team_key = current_team_players.iter().map(|p| p.id.clone()).collect::<Vec<_>>().join(",");
                            
                            // Calculate Score for this game
                            let mut game_score = 0;
                            // Try from guess first
                            if let Some(score) = payload.bullseye.as_ref().and_then(|b| b.guess.as_ref()).and_then(|g| g.score.as_ref()).and_then(|s| s.points) {
                                game_score = score;
                            } else if let Some(rounds) = &state.rounds {
                                game_score = rounds.iter().filter_map(|r| r.score.as_ref().and_then(|s| s.points)).sum();
                            }

                            let duration = payload.total_duration.unwrap_or(0) as i64;

                            // Update stats
                            let entry = team_stats.entry(team_key.clone()).or_insert((Vec::new(), 0, 0, 0));
                            
                            // Update members if not set (first time)
                            if entry.0.is_empty() {
                                entry.0 = current_team_players;
                            }
                            
                            entry.1 += game_score;
                            entry.2 += 1;
                            entry.3 += duration;
                        }
                    }
                }
            }
        }
    }

    let mut leaderboard: Vec<TeamStats> = team_stats.into_iter().map(|(_key, (members, total_score, count, total_duration))| {
        let team_name = members.iter().map(|p| p.name.clone()).collect::<Vec<_>>().join(", ");
        TeamStats {
            team_name,
            members,
            games_played: count,
            average_score: if count > 0 { total_score as f64 / count as f64 } else { 0.0 },
            total_score,
            total_duration,
        }
    }).collect();

    // Sort by Average Score DESC
    leaderboard.sort_by(|a, b| b.average_score.partial_cmp(&a.average_score).unwrap_or(std::cmp::Ordering::Equal));

    Json(leaderboard)
}

#[derive(Deserialize, IntoParams)]
pub struct StatsQuery {
    pub exclude_abandons: Option<bool>,
    pub map: Option<String>,
    pub score_type: Option<String>, // "personal" or "game"
}

#[derive(Serialize, ToSchema)]
pub struct PlayerStatsDetailed {
    pub player_id: String,
    pub total_games: i32,
    pub average_score: f64,
    pub total_duration: i64,
    pub best_countries: Vec<CountryStat>,
    pub worst_countries: Vec<CountryStat>,
    pub best_teams: Vec<TeamStatSimple>,
    pub score_history: Vec<ScorePoint>,
    pub games: Vec<GameSummary>,
    pub player_name: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct TeamStatSimple {
    team_name: String,
    members: Vec<PlayerInfo>,
    average_score: f64,
    games_played: i32,
}

#[derive(Serialize, ToSchema)]
pub struct ScorePoint {
    date: String,
    score: i32,
    map_name: String,
}

#[utoipa::path(
    get,
    path = "/api/players/{id}/stats",
    params(
        ("id" = String, Path, description = "Player ID"),
        StatsQuery
    ),
    responses(
        (status = 200, description = "Detailed Player Statistics", body = PlayerStatsDetailed)
    )
)]
async fn get_player_stats(
    Path(id): Path<String>,
    Query(params): Query<StatsQuery>,
    State(pool): State<AnyPool>
) -> Json<PlayerStatsDetailed> {
    let rows = sqlx::query("SELECT id, game_id, map_name, score, round_time, total_duration, played_at, data FROM games ORDER BY played_at DESC")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    // 1. Resolve Identity
    // Check if the requested ID is an alias
    let primary_id_opt: Option<String> = sqlx::query_scalar("SELECT primary_id FROM player_aliases WHERE alias_id = $1")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .unwrap_or(None);

    let effective_primary_id = primary_id_opt.unwrap_or_else(|| id.clone());

    // Get all IDs belonging to this identity (Primary + Aliases)
    let mut all_ids: Vec<String> = vec![effective_primary_id.clone()];
    let aliases: Vec<String> = sqlx::query_scalar("SELECT alias_id FROM player_aliases WHERE primary_id = $1")
        .bind(&effective_primary_id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
    all_ids.extend(aliases);

    // Use a HashSet for fast lookup
    let target_ids: std::collections::HashSet<String> = all_ids.into_iter().collect();

    let mut total_games = 0;
    let mut total_score = 0;
    let mut total_duration = 0;
    let mut country_stats: std::collections::HashMap<String, (i32, i32)> = std::collections::HashMap::new();
    let mut team_stats: std::collections::HashMap<String, (Vec<PlayerInfo>, i32, i32)> = std::collections::HashMap::new();
    let mut score_history: Vec<ScorePoint> = Vec::new();
    let mut player_games: Vec<GameSummary> = Vec::new();

    // Fetch all known players for name resolution
    let mut known_players: std::collections::HashMap<String, String> = sqlx::query("SELECT id, name FROM players")
        .fetch_all(&pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|row| (row.get("id"), row.get("name")))
        .collect();

    for row in rows {
        let data_str: Option<String> = row.get("data");
        if let Some(data_str) = data_str {
            if let Ok(payload) = serde_json::from_str::<BullseyePayload>(&data_str) {
                if let Some(state) = payload.bullseye.as_ref().and_then(|b| b.state.as_ref()) {
                    
                    // Learn names from this game (before filtering)
                    if let Some(players) = &state.players {
                        for p in players {
                            if let (Some(pid), Some(nick)) = (&p.player_id, &p.nick) {
                                known_players.insert(pid.clone(), nick.clone());
                            }
                        }
                    }

                    // Filter by Map
                    if let Some(map_filter) = &params.map {
                        if let Some(map_name) = &state.map_name {
                            if !map_name.to_lowercase().contains(&map_filter.to_lowercase()) {
                                continue;
                            }
                        } else {
                            continue; 
                        }
                    }

                    // Check if ANY of our target IDs are in this game
                    let mut player_in_game = false;
                    let mut player_score = 0;
                    let mut team_members: Vec<PlayerInfo> = Vec::new();

                    if let Some(players) = &state.players {
                        // Find the first matching player from our target_ids list
                        // In theory, a game shouldn't have multiple players that are actually the same person (unless multi-boxing?)
                        // We'll take the first match.
                        if let Some(p) = players.iter().find(|p| p.player_id.as_ref().map(|pid| target_ids.contains(pid)).unwrap_or(false)) {
                            player_in_game = true;
                            
                            // Calculate score based on preference
                            let use_game_score = params.score_type.as_deref() == Some("game");
                            
                            if use_game_score {
                                // Force Game Score (sum of round scores)
                                if let Some(rounds) = &state.rounds {
                                    player_score = rounds.iter().filter_map(|r| r.score.as_ref().and_then(|s| s.points)).sum();
                                }
                            } else {
                                // Default / Personal Score
                                if let Some(guesses) = &p.guesses {
                                    player_score = guesses.iter().filter_map(|g| g.score.as_ref().and_then(|s| s.points)).sum();
                                } else {
                                    // Fallback to round scores sum if no guesses found (legacy/co-op fallback)
                                    if let Some(rounds) = &state.rounds {
                                        player_score = rounds.iter().filter_map(|r| r.score.as_ref().and_then(|s| s.points)).sum();
                                    }
                                }
                            }

                            // Extract team members
                            team_members = players.iter().map(|p| {
                                let pid = p.player_id.clone().unwrap_or_default();
                                let name = p.nick.clone()
                                    .or_else(|| known_players.get(&pid).cloned())
                                    .or_else(|| p.player_id.clone())
                                    .unwrap_or_else(|| "Unknown".to_string());
                                PlayerInfo { id: pid, name }
                            }).collect();
                        }
                    }

                    if !player_in_game {
                        continue;
                    }

                    // Filter Abandons
                    let is_finished = state.status.as_deref().map(|s| s.eq_ignore_ascii_case("finished")).unwrap_or(false);
                    if params.exclude_abandons == Some(true) && !is_finished {
                        continue;
                    }

                    // --- Aggregation ---
                    total_games += 1;
                    total_score += player_score;
                    total_duration += payload.total_duration.unwrap_or(0) as i64;

                    // Country Stats
                    if let Some(rounds) = &state.rounds {
                        for round in rounds {
                            if let Some(cc) = round.panorama.as_ref().and_then(|p| p.country_code.as_ref()) {
                                let points = round.score.as_ref().and_then(|s| s.points).unwrap_or(0);
                                let entry = country_stats.entry(cc.to_lowercase()).or_insert((0, 0));
                                entry.0 += points;
                                entry.1 += 1;
                            }
                        }
                    }

                    // Team Stats (excluding solo games if desired, but user said "best teams")
                    if team_members.len() > 1 {
                        team_members.sort_by(|a, b| a.id.cmp(&b.id));
                        let team_key = team_members.iter().map(|p| p.id.clone()).collect::<Vec<_>>().join(",");
                        // We need to store the resolved members, so we use the ones we just extracted
                        let entry = team_stats.entry(team_key).or_insert((team_members.clone(), 0, 0));
                        entry.1 += player_score;
                        entry.2 += 1;
                    }

                    // Score History
                    let mut played_at_str: String = row.try_get("played_at").unwrap_or_default();
                    // Try to extract real date from rounds (same logic as get_games)
                    if let Some(rounds) = &state.rounds {
                         if let Some(first_round) = rounds.iter().find(|r| r.round_number == Some(1)) {
                             if let Some(start) = &first_round.start_time {
                                 played_at_str = start.clone();
                             }
                        } else if let Some(first) = rounds.first() {
                             if let Some(start) = &first.start_time {
                                 played_at_str = start.clone();
                             }
                        }
                    }

                    score_history.push(ScorePoint {
                        date: played_at_str.clone(),
                        score: player_score,
                        map_name: state.map_name.clone().unwrap_or_default(),
                    });

                    // Add to games list (simplified summary)
                    // Reuse logic from get_games or just construct it
                    let id_db: i64 = row.try_get("id").unwrap_or(0);
                    let game_id_str: Option<String> = row.try_get("game_id").unwrap_or_default();
                    let map_name_str: Option<String> = row.try_get("map_name").unwrap_or_default();
                    let round_time_val: Option<i64> = row.try_get("round_time").unwrap_or_default();
                    let total_duration_val: Option<i64> = row.try_get("total_duration").unwrap_or_default();
                    
                    // Extract Country Codes
                    let mut country_codes = Vec::new();
                    let mut round_count = 0;
                    if let Some(rounds) = &state.rounds {
                        round_count = rounds.len() as i64;
                        for round in rounds {
                            if let Some(cc) = round.panorama.as_ref().and_then(|p| p.country_code.as_ref()) {
                                country_codes.push(cc.clone());
                            }
                        }
                    }

                    // Re-extract team members for the summary (already have them)
                    
                    player_games.push(GameSummary {
                        id: id_db,
                        game_id: game_id_str,
                        map_name: map_name_str,
                        score: Some(player_score as i64),
                        round_time: round_time_val,
                        round_count,
                        total_duration: total_duration_val,
                        played_at: played_at_str,
                        players: team_members.clone(), // Use the ones extracted above
                        country_codes,
                        max_score: round_count * 5000,
                        is_finished,
                    });
                }
            }
        }
    }

    // Process Country Stats
    let mut all_countries: Vec<CountryStat> = country_stats.into_iter().map(|(code, (total, count))| {
        CountryStat {
            country_code: code,
            total_score: total,
            count,
            average: if count > 0 { total as f64 / count as f64 } else { 0.0 },
        }
    }).collect();

    // Sort for Best (Avg DESC)
    all_countries.sort_by(|a, b| b.average.partial_cmp(&a.average).unwrap_or(std::cmp::Ordering::Equal));
    let best_countries = all_countries.iter().take(3).cloned().collect();

    // Sort for Worst (Avg ASC)
    all_countries.sort_by(|a, b| a.average.partial_cmp(&b.average).unwrap_or(std::cmp::Ordering::Equal));
    let worst_countries = all_countries.iter().take(3).cloned().collect();

    // Process Team Stats
    let mut best_teams: Vec<TeamStatSimple> = team_stats.into_iter().map(|(_key, (members, total, count))| {
        TeamStatSimple {
            team_name: members.iter().map(|p| p.name.clone()).collect::<Vec<_>>().join(", "),
            members,
            average_score: if count > 0 { total as f64 / count as f64 } else { 0.0 },
            games_played: count,
        }
    }).collect();
    best_teams.sort_by(|a, b| b.average_score.partial_cmp(&a.average_score).unwrap_or(std::cmp::Ordering::Equal));

    // Fetch player name (using effective primary ID)
    let mut player_name: Option<String> = sqlx::query_scalar("SELECT name FROM players WHERE id = ?")
        .bind(&effective_primary_id)
        .fetch_optional(&pool)
        .await
        .unwrap_or(None);

    // Fallback: Try to find name in known_players if not in DB
    if player_name.is_none() {
        if let Some(name) = known_players.get(&effective_primary_id) {
            player_name = Some(name.clone());
        }
    }

    Json(PlayerStatsDetailed {
        player_id: effective_primary_id, // Return the primary ID
        total_games,
        average_score: if total_games > 0 { total_score as f64 / total_games as f64 } else { 0.0 },
        total_duration,
        best_countries,
        worst_countries,
        best_teams,
        score_history,
        games: player_games,
        player_name,
    })
}

#[derive(Serialize, ToSchema)]
struct TeamStatsDetailed {
    team_id: String,
    team_name: String,
    members: Vec<PlayerInfo>,
    total_games: i32,
    average_score: f64,
    total_duration: i64,
    best_countries: Vec<CountryStat>,
    worst_countries: Vec<CountryStat>,
    score_history: Vec<ScorePoint>,
    games: Vec<GameSummary>,
}

#[utoipa::path(
    get,
    path = "/api/teams/{id}/stats",
    params(
        ("id" = String, Path, description = "Comma separated Player IDs"),
        StatsQuery
    ),
    responses(
        (status = 200, description = "Detailed Team Statistics", body = TeamStatsDetailed)
    )
)]
async fn get_team_stats(
    Path(id): Path<String>,
    Query(params): Query<StatsQuery>,
    State(pool): State<AnyPool>
) -> Json<TeamStatsDetailed> {
    // 1. Fetch Alias Map
    let aliases = sqlx::query("SELECT alias_id, primary_id FROM player_aliases")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    let mut alias_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for row in aliases {
        let alias_id: String = row.get("alias_id");
        let primary_id: String = row.get("primary_id");
        alias_map.insert(alias_id, primary_id);
    }

    // 2. Resolve Requested Team IDs to Primary IDs
    let team_player_ids: Vec<String> = id.split(',')
        .map(|s| {
            let trimmed = s.trim().to_string();
            alias_map.get(&trimmed).cloned().unwrap_or(trimmed)
        })
        .collect();
    
    let mut team_player_ids_sorted = team_player_ids.clone();
    team_player_ids_sorted.sort();
    // Deduplicate in case multiple aliases of the same person were requested
    team_player_ids_sorted.dedup();

    let rows = sqlx::query("SELECT id, game_id, map_name, score, round_time, total_duration, played_at, data FROM games ORDER BY played_at DESC")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    let mut total_games = 0;
    let mut total_score = 0;
    let mut total_duration = 0;
    let mut country_stats: std::collections::HashMap<String, (i32, i32)> = std::collections::HashMap::new();
    let mut score_history: Vec<ScorePoint> = Vec::new();
    let mut team_games: Vec<GameSummary> = Vec::new();
    let mut team_members_info: Vec<PlayerInfo> = Vec::new();

    // Fetch known players for name resolution
    let mut known_players: std::collections::HashMap<String, String> = sqlx::query("SELECT id, name FROM players")
        .fetch_all(&pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|row| (row.get("id"), row.get("name")))
        .collect();

    for row in rows {
        let data_str: Option<String> = row.get("data");
        if let Some(data_str) = data_str {
            if let Ok(payload) = serde_json::from_str::<BullseyePayload>(&data_str) {
                if let Some(state) = payload.bullseye.as_ref().and_then(|b| b.state.as_ref()) {
                    
                    // Learn names
                    if let Some(players) = &state.players {
                        for p in players {
                            if let (Some(pid), Some(nick)) = (&p.player_id, &p.nick) {
                                known_players.insert(pid.clone(), nick.clone());
                            }
                        }
                    }

                    // Filter by Map
                    if let Some(map_filter) = &params.map {
                        if let Some(map_name) = &state.map_name {
                            if !map_name.to_lowercase().contains(&map_filter.to_lowercase()) {
                                continue;
                            }
                        } else {
                            continue; 
                        }
                    }

                    // Check if this game matches the team
                    if let Some(players) = &state.players {
                        // Resolve game players to Primary IDs
                        let mut game_player_ids: Vec<String> = players.iter()
                            .map(|p| {
                                let pid = p.player_id.clone().unwrap_or_default();
                                alias_map.get(&pid).cloned().unwrap_or(pid)
                            })
                            .collect();
                        game_player_ids.sort();
                        game_player_ids.dedup();

                        if game_player_ids != team_player_ids_sorted {
                            continue;
                        }

                        // Capture member info from the first matching game (using resolved names/IDs if possible, but keeping original structure)
                        // Actually, we should probably show the Primary ID info if possible, or just the names from the game.
                        // Let's stick to names from the game for now, but maybe we should resolve them to the primary name?
                        // For now, just use the game's info.
                        if team_members_info.is_empty() {
                            team_members_info = players.iter().map(|p| {
                                let pid = p.player_id.clone().unwrap_or_default();
                                // Try to get the name of the PRIMARY ID if it's an alias
                                let primary_id = alias_map.get(&pid).cloned().unwrap_or(pid.clone());
                                
                                // Name resolution: 
                                // 1. Try known_players[primary_id] (Best: Primary Name)
                                // 2. Try known_players[pid] (Fallback: Alias Name)
                                // 3. Try p.nick (Game Name)
                                let name = known_players.get(&primary_id).cloned()
                                    .or_else(|| known_players.get(&pid).cloned())
                                    .or_else(|| p.nick.clone())
                                    .unwrap_or_else(|| "Unknown".to_string());

                                PlayerInfo {
                                    id: primary_id, // Use Primary ID
                                    name
                                }
                            }).collect();
                        }
                    } else {
                        continue;
                    }

                    // Filter Abandons
                    let is_finished = state.status.as_deref().map(|s| s.eq_ignore_ascii_case("finished")).unwrap_or(false);
                    if params.exclude_abandons == Some(true) && !is_finished {
                        continue;
                    }

                    // Calculate Game Score
                    let mut game_score = 0;
                    if let Some(score) = payload.bullseye.as_ref().and_then(|b| b.guess.as_ref()).and_then(|g| g.score.as_ref()).and_then(|s| s.points) {
                        game_score = score;
                    } else if let Some(rounds) = &state.rounds {
                        game_score = rounds.iter().filter_map(|r| r.score.as_ref().and_then(|s| s.points)).sum();
                    }

                    // --- Aggregation ---
                    total_games += 1;
                    total_score += game_score;
                    total_duration += payload.total_duration.unwrap_or(0) as i64;

                    // Country Stats
                    if let Some(rounds) = &state.rounds {
                        for round in rounds {
                            if let Some(cc) = round.panorama.as_ref().and_then(|p| p.country_code.as_ref()) {
                                let points = round.score.as_ref().and_then(|s| s.points).unwrap_or(0);
                                let entry = country_stats.entry(cc.to_lowercase()).or_insert((0, 0));
                                entry.0 += points;
                                entry.1 += 1;
                            }
                        }
                    }

                    // Score History
                    let mut played_at_str: String = row.try_get("played_at").unwrap_or_default();
                    if let Some(rounds) = &state.rounds {
                         if let Some(first_round) = rounds.iter().find(|r| r.round_number == Some(1)) {
                             if let Some(start) = &first_round.start_time {
                                 played_at_str = start.clone();
                             }
                        } else if let Some(first) = rounds.first() {
                             if let Some(start) = &first.start_time {
                                 played_at_str = start.clone();
                             }
                        }
                    }

                    score_history.push(ScorePoint {
                        date: played_at_str.clone(),
                        score: game_score,
                        map_name: state.map_name.clone().unwrap_or_default(),
                    });

                    // Add to games list
                    let id_db: i64 = row.try_get("id").unwrap_or(0);
                    let game_id_str: Option<String> = row.try_get("game_id").unwrap_or_default();
                    let map_name_str: Option<String> = row.try_get("map_name").unwrap_or_default();
                    let round_time_val: Option<i64> = row.try_get("round_time").unwrap_or_default();
                    let total_duration_val: Option<i64> = row.try_get("total_duration").unwrap_or_default();
                    
                    let mut country_codes = Vec::new();
                    let mut round_count = 0;
                    if let Some(rounds) = &state.rounds {
                        round_count = rounds.len() as i64;
                        for round in rounds {
                            if let Some(cc) = round.panorama.as_ref().and_then(|p| p.country_code.as_ref()) {
                                country_codes.push(cc.clone());
                            }
                        }
                    }

                    team_games.push(GameSummary {
                        id: id_db,
                        game_id: game_id_str,
                        map_name: map_name_str,
                        score: Some(game_score as i64),
                        round_time: round_time_val,
                        round_count,
                        total_duration: total_duration_val,
                        played_at: played_at_str,
                        players: team_members_info.clone(),
                        country_codes,
                        max_score: round_count * 5000,
                        is_finished,
                    });
                }
            }
        }
    }

    // Process Country Stats
    let mut all_countries: Vec<CountryStat> = country_stats.into_iter().map(|(code, (total, count))| {
        CountryStat {
            country_code: code,
            total_score: total,
            count,
            average: if count > 0 { total as f64 / count as f64 } else { 0.0 },
        }
    }).collect();

    all_countries.sort_by(|a, b| b.average.partial_cmp(&a.average).unwrap_or(std::cmp::Ordering::Equal));
    let best_countries = all_countries.iter().take(3).cloned().collect();

    all_countries.sort_by(|a, b| a.average.partial_cmp(&b.average).unwrap_or(std::cmp::Ordering::Equal));
    let worst_countries = all_countries.iter().take(3).cloned().collect();

    let team_name = team_members_info.iter().map(|p| p.name.clone()).collect::<Vec<_>>().join(", ");

    Json(TeamStatsDetailed {
        team_id: id,
        team_name,
        members: team_members_info,
        total_games,
        average_score: if total_games > 0 { total_score as f64 / total_games as f64 } else { 0.0 },
        total_duration,
        best_countries,
        worst_countries,
        score_history,
        games: team_games,
    })
}

// --- Admin Handlers ---

#[derive(Deserialize, ToSchema)]
struct PlayerLinkRequest {
    alias_id: String,
    primary_id: String,
}

#[derive(Deserialize, ToSchema)]
struct PlayerUnlinkRequest {
    alias_id: String,
}

#[derive(Serialize, ToSchema)]
struct AdminPlayerInfo {
    id: String,
    name: String,
    primary_id: Option<String>,
    aliases: Vec<String>,
}

#[utoipa::path(
    get,
    path = "/api/admin/players",
    responses(
        (status = 200, description = "List all players with alias info", body = Vec<AdminPlayerInfo>)
    )
)]
async fn get_admin_players(State(pool): State<AnyPool>) -> Json<Vec<AdminPlayerInfo>> {
    // 0. Backfill players from games table (if missing)
    let game_rows = sqlx::query("SELECT data FROM games")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    println!("Debug: Backfill - Fetched {} games", game_rows.len());

    let mut found_players: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    for row in game_rows {
        let data_str: Option<String> = row.get("data");
        if let Some(data_str) = data_str {
            if let Ok(payload) = serde_json::from_str::<BullseyePayload>(&data_str) {
                if let Some(state) = payload.bullseye.as_ref().and_then(|b| b.state.as_ref()) {
                    if let Some(players) = &state.players {
                        for p in players {
                            if let (Some(pid), Some(nick)) = (&p.player_id, &p.nick) {
                                found_players.insert(pid.clone(), nick.clone());
                            }
                        }
                    }
                }
            } else {
                println!("Debug: Failed to parse game payload");
            }
        }
    }

    println!("Debug: Backfill - Found {} unique players", found_players.len());

    // Upsert found players into DB
    for (id, name) in found_players {
        let res = sqlx::query(
            "INSERT INTO players (id, name, last_seen) VALUES ($1, $2, CURRENT_TIMESTAMP) 
             ON CONFLICT(id) DO UPDATE SET name = excluded.name"
        )
        .bind(&id)
        .bind(&name)
        .execute(&pool)
        .await;
        
        if let Err(e) = res {
            println!("Debug: Failed to upsert player {}: {:?}", id, e);
        }
    }

    // 1. Get all players
    let players = sqlx::query("SELECT id, name FROM players")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    println!("Debug: Final fetch - Got {} players", players.len());

    // 2. Get all aliases
    let aliases = sqlx::query("SELECT alias_id, primary_id FROM player_aliases")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

    // Build lookup maps
    let mut alias_map: std::collections::HashMap<String, String> = std::collections::HashMap::new(); // alias -> primary
    let mut reverse_alias_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new(); // primary -> [aliases]

    for row in aliases {
        let alias_id: String = row.get("alias_id");
        let primary_id: String = row.get("primary_id");
        alias_map.insert(alias_id.clone(), primary_id.clone());
        reverse_alias_map.entry(primary_id).or_default().push(alias_id);
    }

    let mut result = Vec::new();
    for row in players {
        let id: String = row.get("id");
        let name: String = row.get("name");
        
        let primary_id = alias_map.get(&id).cloned();
        let aliases = reverse_alias_map.get(&id).cloned().unwrap_or_default();

        result.push(AdminPlayerInfo {
            id,
            name,
            primary_id,
            aliases,
        });
    }

    Json(result)
}

#[utoipa::path(
    post,
    path = "/api/admin/link",
    request_body = PlayerLinkRequest,
    responses(
        (status = 200, description = "Player linked successfully"),
        (status = 400, description = "Invalid request (circular link, etc.)")
    )
)]
async fn link_player(
    State(pool): State<AnyPool>,
    Json(payload): Json<PlayerLinkRequest>,
) -> StatusCode {
    if payload.alias_id == payload.primary_id {
        return StatusCode::BAD_REQUEST;
    }

    // Prevent circular dependency: Check if primary_id is already an alias of alias_id (or anyone else)
    // For simplicity, just ensure primary_id is NOT an alias itself. 
    // A more robust check would traverse the tree, but 1-level depth is easier to manage.
    // Rule: A Primary ID cannot be an Alias. An Alias cannot have Aliases.
    
    // Check if primary is already an alias
    let primary_is_alias = sqlx::query("SELECT 1 FROM player_aliases WHERE alias_id = $1")
        .bind(&payload.primary_id)
        .fetch_optional(&pool)
        .await
        .unwrap_or(None)
        .is_some();

    if primary_is_alias {
        return StatusCode::BAD_REQUEST; // Target is already an alias
    }

    // Check if alias already has aliases (cannot make a parent a child)
    let alias_has_children = sqlx::query("SELECT 1 FROM player_aliases WHERE primary_id = $1")
        .bind(&payload.alias_id)
        .fetch_optional(&pool)
        .await
        .unwrap_or(None)
        .is_some();

    if alias_has_children {
        return StatusCode::BAD_REQUEST; // Source already has children
    }

    // Upsert the link
    let _ = sqlx::query(
        "INSERT INTO player_aliases (alias_id, primary_id) VALUES ($1, $2) 
         ON CONFLICT(alias_id) DO UPDATE SET primary_id = excluded.primary_id"
    )
    .bind(&payload.alias_id)
    .bind(&payload.primary_id)
    .execute(&pool)
    .await;

    StatusCode::OK
}

#[utoipa::path(
    post,
    path = "/api/admin/unlink",
    request_body = PlayerUnlinkRequest,
    responses(
        (status = 200, description = "Player unlinked successfully")
    )
)]
async fn unlink_player(
    State(pool): State<AnyPool>,
    Json(payload): Json<PlayerUnlinkRequest>,
) -> StatusCode {
    let _ = sqlx::query("DELETE FROM player_aliases WHERE alias_id = $1")
        .bind(&payload.alias_id)
        .execute(&pool)
        .await;

    StatusCode::OK
}
