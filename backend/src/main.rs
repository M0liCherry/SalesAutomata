mod config;
mod error;
mod models;
mod query;
mod routes;
mod state;
mod supabase;

use std::sync::Arc;

use anyhow::Result;
use config::Config;
use state::AppState;
use supabase::Supabase;
use tracing_subscriber::EnvFilter;
// hello >:) best of luck reading the code
#[tokio::main]
async fn main() -> Result<()> {
    // Load the single repo-root .env regardless of the current working directory.
    dotenvy::from_path(concat!(env!("CARGO_MANIFEST_DIR"), "/../.env")).ok();
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("backend=info,tower_http=info")),
        )
        .init();

    let config = Config::from_env()?;
    let supabase = Arc::new(Supabase::new(
        config.supabase_url.clone(),
        config.supabase_service_role_key.clone(),
    )?);

    let app = routes::router(AppState { supabase }, &config.cors_origin);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;
    tracing::info!(port = config.port, "backend listening");

    axum::serve(listener, app).await?;
    Ok(())
}
