mod activities;
mod agents;
mod appointments;
mod conversations;
mod dashboard;
mod follow_ups;
mod interested_leads;
mod leads;
mod messages;
mod projects;
mod properties;
mod templates;

use axum::{
    Json, Router,
    http::{
        HeaderValue, Method, StatusCode,
        header::{AUTHORIZATION, CONTENT_TYPE},
    },
    response::IntoResponse,
    routing::get,
};
use serde_json::json;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use crate::state::AppState;

pub fn router(state: AppState, cors_origin: &str) -> Router {
    Router::new()
        .route("/", get(index))
        .route("/health", get(health))
        .route("/api/leads", get(leads::list))
        .route("/api/leads/{id}", get(leads::get_one))
        .route("/api/properties", get(properties::list).post(properties::create))
        .route(
            "/api/properties/{id}",
            get(properties::get_one).patch(properties::update),
        )
        .route("/api/projects", get(projects::list).post(projects::create))
        .route(
            "/api/projects/{id}",
            get(projects::get_one).patch(projects::update),
        )
        .route("/api/agents", get(agents::list))
        .route("/api/agents/{id}", get(agents::get_one))
        .route("/api/conversations", get(conversations::list))
        .route("/api/conversations/{id}", get(conversations::get_one))
        .route("/api/messages", get(messages::list))
        .route("/api/appointments", get(appointments::list))
        .route("/api/follow-ups", get(follow_ups::list))
        .route("/api/activities", get(activities::list))
        .route("/api/interested-leads", get(interested_leads::list))
        .route("/api/message-templates", get(templates::list))
        .route("/api/dashboard/summary", get(dashboard::summary))
        .layer(build_cors(cors_origin))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn index() -> impl IntoResponse {
    Json(json!({
        "service": "SalesAutomata backend",
        "description": "JSON API over the Supabase project.",
        "endpoints": [
            "GET /health",
            "GET /api/dashboard/summary",
            "GET /api/leads?status=&source=&city=&assigned_agent_id=&min_score=&search=&limit=&offset=",
            "GET /api/leads/{id}",
            "GET /api/properties?city=&property_type=&listing_type=&min_price=&max_price=&bedrooms=&availability=&status=&project_id=&search=&limit=&offset=",
            "GET /api/properties/{id}",
            "POST /api/properties",
            "PATCH /api/properties/{id}",
            "GET /api/projects?city=&status=&project_type=&search=&limit=&offset=",
            "GET /api/projects/{id}",
            "POST /api/projects",
            "PATCH /api/projects/{id}",
            "GET /api/agents?is_active=&search=&limit=&offset=",
            "GET /api/agents/{id}",
            "GET /api/conversations?lead_id=&status=&channel=&limit=&offset=",
            "GET /api/conversations/{id}",
            "GET /api/messages?lead_id=&conversation_id=&limit=&offset=",
            "GET /api/appointments?lead_id=&agent_id=&status=&upcoming=&limit=&offset=",
            "GET /api/follow-ups?lead_id=&status=&due_before=&limit=&offset=",
            "GET /api/activities?lead_id=&activity_type=&limit=&offset=",
            "GET /api/interested-leads?status=&source=&limit=&offset=",
            "GET /api/message-templates?category=&is_active=&limit=&offset="
        ]
    }))
}

async fn health(axum::extract::State(state): axum::extract::State<AppState>) -> impl IntoResponse {
    match state.supabase.health().await {
        Ok(()) => (
            StatusCode::OK,
            Json(json!({ "status": "ok", "supabase": "reachable" })),
        ),
        Err(error) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "status": "degraded",
                "supabase": "unreachable",
                "error": error.to_string()
            })),
        ),
    }
}

fn build_cors(origin: &str) -> CorsLayer {
    let layer = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE, AUTHORIZATION]);

    if origin.trim() == "*" {
        layer.allow_origin(Any)
    } else {
        let origins = origin
            .split(',')
            .filter_map(|value| value.trim().parse::<HeaderValue>().ok())
            .collect::<Vec<_>>();
        layer.allow_origin(origins)
    }
}
