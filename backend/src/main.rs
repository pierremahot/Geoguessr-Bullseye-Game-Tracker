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

#[derive(OpenApi)]
#[openapi(
    paths(
        health_check,
        submit_game
    ),
    components(
        schemas(
            BullseyePayload, BullseyeData, BullseyeState, GameOptions, MovementOptions, 
            Round, Panorama, Player, Guess, Score, BoundingBox, LatLng
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

    let score = payload.bullseye.as_ref()
        .and_then(|b| b.guess.as_ref())
        .and_then(|g| g.score.as_ref())
        .and_then(|s| s.points)
        .unwrap_or(0);

    let round_time = payload.bullseye.as_ref()
        .and_then(|b| b.state.as_ref())
        .and_then(|s| s.options.as_ref())
        .and_then(|o| o.round_time);

    // total_duration is not directly in the new payload, we can set it to None or calculate it if needed.
    // For now, let's set it to None or 0.
    let total_duration: Option<i32> = None;

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
