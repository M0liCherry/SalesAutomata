use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;

use crate::{
    error::AppError,
    models::{ListResponse, Project, ProjectDetail, ProjectPayload},
    query,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListProjectsQuery {
    pub city: Option<String>,
    pub status: Option<String>,
    pub project_type: Option<String>,
    pub search: Option<String>,
    pub order: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListProjectsQuery>,
) -> Result<Json<ListResponse<Project>>, AppError> {
    let (limit, offset) = query::pagination(query.limit, query.offset);

    let mut params = Vec::new();
    query::select(&mut params, "*");
    query::eq(&mut params, "city", query.city.as_deref());
    query::eq(&mut params, "status", query.status.as_deref());
    query::eq(&mut params, "project_type", query.project_type.as_deref());
    query::search(
        &mut params,
        &["name", "developer", "city", "locality", "description"],
        query.search.as_deref(),
    );
    query::order(&mut params, query.order.as_deref(), "created_at.desc");
    query::page(&mut params, limit, offset);

    let (value, count) = state.supabase.list("projects", &params).await?;
    let data = serde_json::from_value(value)?;

    Ok(Json(ListResponse {
        data,
        count,
        limit,
        offset,
    }))
}

pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<ProjectPayload>,
) -> Result<Json<Project>, AppError> {
    if payload
        .name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        return Err(AppError::BadRequest("name is required".to_string()));
    }
    if payload
        .project_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        return Err(AppError::BadRequest(
            "project_type is required".to_string(),
        ));
    }
    if payload
        .city
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        return Err(AppError::BadRequest("city is required".to_string()));
    }

    let body = serde_json::to_value(&payload)?;
    let value = state.supabase.insert("projects", &body).await?;
    let mut items: Vec<Project> = serde_json::from_value(value)?;
    items
        .pop()
        .map(Json)
        .ok_or_else(|| AppError::Upstream("insert returned no rows".to_string()))
}

pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<ProjectPayload>,
) -> Result<Json<Project>, AppError> {
    let body = serde_json::to_value(&payload)?;
    if body.as_object().map(|map| map.is_empty()).unwrap_or(false) {
        return Err(AppError::BadRequest("nothing to update".to_string()));
    }

    let value = state.supabase.update("projects", &id, &body).await?;
    let mut items: Vec<Project> = serde_json::from_value(value)?;
    items.pop().map(Json).ok_or(AppError::NotFound)
}

pub async fn get_one(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ProjectDetail>, AppError> {
    let mut params = Vec::new();
    query::select(&mut params, "*,properties(*)");
    params.push(("id".to_string(), format!("eq.{id}")));
    params.push(("limit".to_string(), "1".to_string()));
    params.push((
        "properties.order".to_string(),
        "created_at.desc".to_string(),
    ));

    let (value, _) = state.supabase.list("projects", &params).await?;
    let mut items: Vec<ProjectDetail> = serde_json::from_value(value)?;

    items.pop().map(Json).ok_or(AppError::NotFound)
}
