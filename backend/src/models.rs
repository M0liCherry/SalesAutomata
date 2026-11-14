use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub specialization: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub developer: Option<String>,
    pub project_type: String,
    pub status: String,
    pub city: String,
    pub locality: Option<String>,
    pub address: Option<String>,
    pub possession_date: Option<String>,
    #[serde(default)]
    pub amenities: Vec<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Property {
    pub id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub property_type: String,
    pub listing_type: String,
    pub price: f64,
    pub price_per_sqft: Option<f64>,
    pub bedrooms: Option<i32>,
    pub bathrooms: Option<i32>,
    pub balconies: Option<i32>,
    pub area_sqft: Option<f64>,
    pub floor: Option<i32>,
    pub total_floors: Option<i32>,
    pub furnishing: Option<String>,
    pub facing: Option<String>,
    pub parking: Option<i32>,
    pub availability: String,
    pub status: String,
    pub city: String,
    pub locality: Option<String>,
    pub address: Option<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub features: Vec<String>,
    #[serde(default)]
    pub images: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lead {
    pub id: String,
    pub phone: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub source: String,
    pub status: String,
    pub listing_type: Option<String>,
    pub property_type: Option<String>,
    pub budget_min: Option<f64>,
    pub budget_max: Option<f64>,
    pub preferred_city: Option<String>,
    pub preferred_locality: Option<String>,
    pub bedrooms: Option<i32>,
    pub purpose: Option<String>,
    pub timeline: Option<String>,
    pub qualification_score: i32,
    pub assigned_agent_id: Option<String>,
    pub last_contacted_at: Option<String>,
    pub next_follow_up_at: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub lead_id: String,
    pub channel: String,
    pub status: String,
    pub started_at: String,
    pub last_message_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub lead_id: String,
    pub direction: String,
    pub sender: String,
    pub body: String,
    pub message_type: String,
    pub whatsapp_message_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appointment {
    pub id: String,
    pub lead_id: String,
    pub property_id: Option<String>,
    pub agent_id: Option<String>,
    pub appointment_type: String,
    pub scheduled_at: String,
    pub duration_minutes: i32,
    pub status: String,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FollowUp {
    pub id: String,
    pub lead_id: String,
    pub due_at: String,
    pub channel: String,
    pub note: Option<String>,
    pub status: String,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeadActivity {
    pub id: String,
    pub lead_id: String,
    pub activity_type: String,
    pub description: Option<String>,
    #[serde(default)]
    pub metadata: Value,
    pub created_by: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterestedLead {
    pub id: String,
    pub lead_id: Option<String>,
    pub name: String,
    pub phone: String,
    pub email: Option<String>,
    pub budget_min: Option<f64>,
    pub budget_max: Option<f64>,
    pub preferred_city: Option<String>,
    pub preferred_locality: Option<String>,
    pub property_type: Option<String>,
    pub bedrooms: Option<i32>,
    pub purpose: Option<String>,
    pub property_id: Option<String>,
    pub message: Option<String>,
    pub source: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageTemplate {
    pub id: String,
    pub name: String,
    pub category: String,
    pub content: String,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PropertyPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub property_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub listing_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_per_sqft: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bedrooms: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bathrooms: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balconies: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub area_sqft: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub floor: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_floors: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub furnishing: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub facing: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parking: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub availability: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub features: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProjectPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub developer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub possession_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amenities: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeadDetail {
    #[serde(flatten)]
    pub lead: Lead,
    pub agents: Option<Agent>,
    #[serde(default)]
    pub conversations: Vec<Conversation>,
    #[serde(default)]
    pub appointments: Vec<Appointment>,
    #[serde(default)]
    pub follow_ups: Vec<FollowUp>,
    #[serde(default)]
    pub lead_activities: Vec<LeadActivity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyDetail {
    #[serde(flatten)]
    pub property: Property,
    pub projects: Option<Project>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDetail {
    #[serde(flatten)]
    pub project: Project,
    #[serde(default)]
    pub properties: Vec<Property>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationDetail {
    #[serde(flatten)]
    pub conversation: Conversation,
    pub leads: Option<Lead>,
    #[serde(default)]
    pub messages: Vec<Message>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDetail {
    #[serde(flatten)]
    pub agent: Agent,
    #[serde(default)]
    pub leads: Vec<Lead>,
}

#[derive(Debug, Serialize)]
pub struct ListResponse<T> {
    pub data: Vec<T>,
    pub count: Option<i64>,
    pub limit: i64,
    pub offset: i64,
}
