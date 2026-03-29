# Kubeblast 1.3.0 🌅

## What's new?

### Real-time performance metrics  
View live performance charts directly in the **Job Details** page while tests are running; Kubeblast now streams JMeter metrics to **InfluxDB** (built-in or external) for instant visualization in the UI.

### Built-in JMeter plan editor  
Edit JMX test plans directly from the UI with validation and approval rules applied automatically.

### Better report handling  
In-browser reports have been removed; reports and results are now downloaded with consistent artifact naming.

### Improved experience
Refined UI delivers a cleaner and smoother visual experience; startup is optimized and faster.

## Fixes

- Sessions no longer end when the browser is closed  
- Improved startup behavior and stability  
- OIDC users retain correct roles after login
- Job logs are now persisted instead of being streamed from pods, so they remain available after job completion

## Breaking changes

- Built-in **InfluxDB** Helm chart is enabled by default for a better out-of-the-box experience (can be disabled)  
- Built-in **MongoDB** now runs as a **StatefulSet**, and PVC naming has changed; ensure proper data migration if you rely on the built-in database  