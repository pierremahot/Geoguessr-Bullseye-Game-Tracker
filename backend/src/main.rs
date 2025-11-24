use axum::{
    extract::{State, Json},
    http::{StatusCode, Method},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{AnyPool, any::AnyPoolOptions};
use sqlx::migrate::MigrateDatabase;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber;

#[tokio::main]
async fn main() {
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

async fn health_check() -> &'static str {
    "OK"
}

#[derive(Deserialize, Serialize, Debug)]
struct GamePayload {
    id: Option<String>,
    #[serde(rename = "mapName")]
    map_name: Option<String>,
    score: i32,
    players: Option<Vec<String>>,
    #[serde(rename = "roundTime")]
    round_time: Option<i32>,
    #[serde(rename = "totalDuration")]
    total_duration: Option<i32>,
    date: Option<String>,
    #[serde(rename = "gaveUp")]
    gave_up: Option<bool>,
    // Add other fields as needed
}

async fn submit_game(
    State(pool): State<AnyPool>,
    Json(payload): Json<GamePayload>,
) -> StatusCode {
    println!("Received game: {:?}", payload);

    let data_json = serde_json::to_string(&payload).unwrap();

    let result = sqlx::query(
        "INSERT INTO games (game_id, map_name, score, round_time, total_duration, data) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(&payload.id)
    .bind(&payload.map_name)
    .bind(payload.score)
    .bind(payload.round_time)
    .bind(payload.total_duration)
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
