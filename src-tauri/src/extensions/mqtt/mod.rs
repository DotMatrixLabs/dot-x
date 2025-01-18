use rumqttc::{AsyncClient, MqttOptions, QoS};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::sync::Mutex;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttConfig {
    broker_ip: String,
    #[serde(deserialize_with = "deserialize_string_to_u16")]
    broker_port: u16,
    username: Option<String>,
    password: Option<String>,
    topic: String,
    enable_ha_discovery: bool,
    ha_discovery_prefix: Option<String>,
    client_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SliderValues {
    #[serde(flatten)]
    values: std::collections::HashMap<String, f64>,
}

// Add this new struct for array input
#[derive(Debug, Serialize, Deserialize)]
pub struct SliderArray(Vec<f64>);

pub struct MqttHandler {
    client: Option<AsyncClient>,
    config: Option<MqttConfig>,
}

impl MqttHandler {
    pub fn new() -> Self {
        Self {
            client: None,
            config: None,
        }
    }

    pub async fn init(&mut self, config: MqttConfig) -> Result<(), Box<dyn std::error::Error>> {
        let mut mqtt_options = MqttOptions::new(
            config.client_id.clone().unwrap_or_else(|| "dot_x".to_string()),
            config.broker_ip.clone(),
            config.broker_port,
        );

        // Set credentials if provided
        if let (Some(username), Some(password)) = (config.username.clone(), config.password.clone()) {
            mqtt_options.set_credentials(username, password);
        }

        mqtt_options.set_keep_alive(Duration::from_secs(30));

        let (client, mut eventloop) = AsyncClient::new(mqtt_options, 10);

        // Handle connection in background task
        let client_clone = client.clone();
        tokio::spawn(async move {
            while let Ok(notification) = eventloop.poll().await {
                println!("MQTT Event: {:?}", notification);
            }
        });

        // Publish availability
        client.publish("dot_x/status", QoS::AtLeastOnce, true, "online").await?;

        // Set up Home Assistant discovery if enabled
        if config.enable_ha_discovery {
            self.setup_ha_discovery(&client, &config).await?;
        }

        self.client = Some(client);
        self.config = Some(config);

        Ok(())
    }

    async fn setup_ha_discovery(&self, client: &AsyncClient, config: &MqttConfig) -> Result<(), Box<dyn std::error::Error>> {
        let discovery_prefix = config.ha_discovery_prefix.as_deref().unwrap_or("homeassistant");
        
        // Device info that will be shared across all sensors
        let device_info = serde_json::json!({
            "identifiers": ["dotMatrixLabs_dot_x"],
            "manufacturer": "DotMatrixLabs",
            "model": "Dot X",
            "name": "Dot X",
            "sw_version": "0.0.1"
        });

        // Create a sensor for each slider (1-5)
        for i in 1..=5 {
            let discovery_topic = format!("{}/sensor/dot_x_slider_{}/config", discovery_prefix, i);
            
            let discovery_payload = serde_json::json!({
                "name": format!("Dot X Slider {}", i),
                "state_topic": format!("{}/slider_values/slider_{}", config.topic, i),
                "device": device_info,
                "availability": [{
                    "topic": "dot_x/status"
                }],
                "enabled_by_default": true,
                "object_id": format!("dot_x_slider_{}", i),
                "unique_id": format!("dot_x_slider_{}", i),
                "unit_of_measurement": "%",
                "state_class": "measurement"
            });

            client.publish(
                discovery_topic,
                QoS::AtLeastOnce,
                true,
                serde_json::to_string(&discovery_payload)?
            ).await?;
        }

        Ok(())
    }

    pub async fn publish_values(&self, values: SliderValues) -> Result<(), Box<dyn std::error::Error>> {
        if let (Some(client), Some(config)) = (&self.client, &self.config) {
            let topic = format!("{}/slider_values", config.topic);
            let payload = serde_json::to_string(&values)?;
            
            client.publish(topic, QoS::AtLeastOnce, true, payload).await?;

            // Publish individual values
            for (key, value) in values.values {
                let topic = format!("{}/slider_values/{}", config.topic, key);
                client.publish(topic, QoS::AtLeastOnce, true, value.to_string()).await?;
            }
        }
        Ok(())
    }

    pub async fn disconnect(&self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(client) = &self.client {
            client.publish("dot_x/status", QoS::AtLeastOnce, true, "offline").await?;
        }
        Ok(())
    }
}

// Create a static MQTT handler
lazy_static::lazy_static! {
    static ref MQTT_HANDLER: Arc<Mutex<MqttHandler>> = Arc::new(Mutex::new(MqttHandler::new()));
}

// Tauri commands
#[tauri::command]
pub async fn init_mqtt(config: MqttConfig) -> Result<(), String> {
    MQTT_HANDLER.lock().await
        .init(config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mqtt_publish_values(values: Vec<f64>) -> Result<(), String> {
    // Convert array to HashMap
    let mut map = std::collections::HashMap::new();
    for (i, value) in values.iter().enumerate() {
        map.insert(format!("slider_{}", i + 1), *value);
    }
    
    MQTT_HANDLER.lock().await
        .publish_values(SliderValues { values: map })
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mqtt_disconnect() -> Result<(), String> {
    MQTT_HANDLER.lock().await
        .disconnect()
        .await
        .map_err(|e| e.to_string())
}

// Add this helper function for string-to-number conversion
fn deserialize_string_to_u16<'de, D>(deserializer: D) -> Result<u16, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s: String = serde::Deserialize::deserialize(deserializer)?;
    s.parse::<u16>().map_err(serde::de::Error::custom)
}
