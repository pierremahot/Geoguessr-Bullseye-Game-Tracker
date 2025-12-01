use axum::{
    extract::{State, Json},
    http::{StatusCode, Method, HeaderMap},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{AnyPool, any::AnyPoolOptions};
use sqlx::migrate::MigrateDatabase;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber;
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;
use utoipa::openapi::security::{SecurityScheme, HttpAuthScheme, Http};
use sqlx::Row;

#[derive(OpenApi)]
#[openapi(
    paths(
        health_check,
        submit_game,
        get_games,
        get_stats
    ),
    components(
        schemas(
            BullseyePayload, BullseyeData, BullseyeState, GameOptions, MovementOptions, 
            Round, Panorama, Player, Guess, Score, BoundingBox, LatLng,
            GameSummary, GameStats, CountryStat, TeamStats
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
            println!("Creating SQLite database...");
            sqlx::Sqlite::create_database(&database_url).await.unwrap();
        }
    }

    let pool = AnyPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to DB");

    // Run migrations
    // Note: For AnyPool, migrations can be tricky if SQL is dialect-specific.
    // We'll assume the SQL is compatible or handle it manually.
    // sqlx::migrate!().run(&pool).await.unwrap();
    
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
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        .allow_methods([Method::GET, Method::POST])
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
        .layer(cors)
        .with_state(pool);

    // Run server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
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
    heading: Option<i32>,
    pitch: Option<i32>,
    zoom: Option<i32>,
}

#[derive(Deserialize, Serialize, Debug, ToSchema)]
struct Player {
    #[serde(rename = "playerId")]
    player_id: Option<String>,
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
) -> StatusCode {
    // Check API Key
    if let Ok(env_api_key) = std::env::var("API_KEY") {
        let auth_header = headers.get("Authorization")
            .and_then(|h| h.to_str().ok());
        
        let expected_token = format!("Bearer {}", env_api_key);
        
        if auth_header != Some(&expected_token) {
            println!("Unauthorized access attempt");
            return StatusCode::UNAUTHORIZED;
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

    let result = sqlx::query(
        "INSERT INTO games (game_id, map_name, score, round_time, total_duration, data) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(game_id)
    .bind(map_name)
    .bind(score)
    .bind(round_time)
    .bind(total_duration)
    .bind(data_json)
    .execute(&pool)
    .await;

    match result {
        Ok(_) => StatusCode::OK,
        Err(e) => {
            eprintln!("DB Error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

#[derive(Serialize, ToSchema)]
struct GameSummary {
    id: i32,
    game_id: Option<String>,
    map_name: Option<String>,
    score: Option<i32>,
    round_time: Option<i32>,
    total_duration: Option<i32>,
    played_at: String,
    players: Vec<String>,
    country_codes: Vec<String>,
    round_count: i32,
    max_score: i32,
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
        "SELECT id, game_id, map_name, score, round_time, total_duration, CAST(played_at AS TEXT) as played_at, data FROM games ORDER BY played_at DESC"
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

    let games = rows.into_iter().map(|row| {
        let mut players = Vec::new();
        let mut country_codes = Vec::new();
        let mut round_count = 0;
        let mut is_finished = false;

        let data_str: Option<String> = row.get("data");
        if let Some(data_str) = data_str {
            if let Ok(payload) = serde_json::from_str::<BullseyePayload>(&data_str) {
                if let Some(state) = payload.bullseye.as_ref().and_then(|b| b.state.as_ref()) {
                    // Extract Players
                    if let Some(p_list) = &state.players {
                        players = p_list.iter().map(|p| p.player_id.clone().unwrap_or_default()).collect();
                    }
                    
                    // Extract Country Codes (Flags)
                    if let Some(rounds) = &state.rounds {
                        round_count = rounds.len() as i32;
                        for round in rounds {
                            if let Some(cc) = round.panorama.as_ref().and_then(|p| p.country_code.as_ref()) {
                                country_codes.push(cc.clone());
                            }
                        }
                    }

                    // Check Status
                    if let Some(status) = &state.status {
                        is_finished = status == "FINISHED"; // Adjust based on actual status string
                    }
                }
            }
        }

        GameSummary {
            id: row.get("id"),
            game_id: row.get("game_id"),
            map_name: row.get("map_name"),
            score: row.get("score"),
            round_time: row.get("round_time"),
            total_duration: row.get("total_duration"),
            played_at: row.try_get::<String, _>("played_at").unwrap_or_default(),
            players,
            country_codes,
            round_count,
            max_score: round_count * 5000,
            is_finished,
        }
    }).collect();

    Json(games)
}

#[derive(Serialize, ToSchema)]
struct GameStats {
    total_games: i64,
    average_score: f64,
    total_duration_seconds: i64,
    best_country_guesses: Vec<CountryStat>,
}

#[derive(Serialize, ToSchema)]
struct CountryStat {
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
    player_ids: Vec<String>,
    games_played: i32,
    average_score: f64,
    total_score: i32,
    total_duration: i64,
}

#[utoipa::path(
    get,
    path = "/api/leaderboard/teams",
    responses(
        (status = 200, description = "Team Leaderboard", body = Vec<TeamStats>)
    )
)]
async fn get_team_leaderboard(State(pool): State<AnyPool>) -> Json<Vec<TeamStats>> {
    let rows = sqlx::query("SELECT data FROM games").fetch_all(&pool).await.unwrap_or_default();

    // Map of Sorted Player IDs -> (Player Names, Total Score, Count, Total Duration)
    let mut team_stats: std::collections::HashMap<String, (Vec<String>, i32, i32, i64)> = std::collections::HashMap::new();

    for row in rows {
        let data_str: Option<String> = row.get("data");
        if let Some(data_str) = data_str {
            if let Ok(payload) = serde_json::from_str::<BullseyePayload>(&data_str) {
                if let Some(state) = payload.bullseye.as_ref().and_then(|b| b.state.as_ref()) {
                    if let Some(players) = &state.players {
                        if !players.is_empty() {
                            // Extract player info
                            let mut current_team_players: Vec<(String, String)> = players.iter().map(|p| {
                                (
                                    p.player_id.clone().unwrap_or_default(),
                                    // Try to find nick in payload if possible, otherwise use ID or "Unknown"
                                    // The payload structure for players in state is minimal (playerId, guesses)
                                    // We might need to look at the top level 'lobby' or 'players' if available
                                    // But for now let's use what we have. 
                                    // Wait, the user provided JSON shows 'players' in 'bullseye.state' has 'playerId' and 'guesses'.
                                    // The 'lobby' has 'nick'.
                                    // Let's try to find the nick from the lobby part of the payload if we saved it?
                                    // The current BullseyePayload struct has 'lobby' as Option<serde_json::Value>.
                                    // We can try to extract nicks from there.
                                    "Unknown".to_string() 
                                )
                            }).collect();

                            // Sort by Player ID to ensure consistent team key
                            current_team_players.sort_by(|a, b| a.0.cmp(&b.0));

                            let team_key = current_team_players.iter().map(|p| p.0.clone()).collect::<Vec<_>>().join(",");
                            
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
                            
                            // Update player IDs if not set (first time)
                            if entry.0.is_empty() {
                                entry.0 = current_team_players.iter().map(|p| p.0.clone()).collect();
                            }
                            
                            // Try to update names if we have "Unknown"
                            // For now, let's just use IDs as names if we can't find better, 
                            // OR we can try to extract names from the lobby data if present.
                            // Let's improve name extraction later.
                            
                            entry.1 += game_score;
                            entry.2 += 1;
                            entry.3 += duration;
                        }
                    }
                }
            }
        }
    }

    let mut leaderboard: Vec<TeamStats> = team_stats.into_iter().map(|(_key, (ids, total_score, count, total_duration))| {
        TeamStats {
            team_name: ids.join(", "), // Placeholder: Use IDs as names for now
            player_ids: ids,
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
