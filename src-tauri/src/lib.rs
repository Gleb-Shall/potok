// Experiment-only command for the separately identified benchmark application.
#[tauri::command]
fn benchmark_scenario() -> &'static str {
    if std::env::args().any(|arg| arg == "--bench-empty") { "empty" } else { "fixture" }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![benchmark_scenario])
        .run(tauri::generate_context!())
        .expect("Could not start Potok");
}
