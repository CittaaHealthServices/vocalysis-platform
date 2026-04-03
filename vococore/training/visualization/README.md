# Vocalysis Visualization Suite 2.0

Comprehensive visualization module for clinical and wellness assessments in the Vocalysis mental health voice analysis platform.

## Architecture

The visualization suite consists of three complementary components:

### 1. Clinical Graphs (`clinical_graphs.py`)
Scientific visualizations designed for mental health professionals.

**Features:**
- **Radar Biomarker Chart**: 8-dimensional clinical profile comparison vs population norms
- **Longitudinal Trend Analysis**: Multi-dimensional score tracking over time with clinical severity bands
- **Feature Heatmap**: 56-feature biomarker matrix showing Z-score deviations from normal
- **Confidence Calibration Curve**: Model reliability assessment for clinical decision support
- **Clinical Scale Mapping**: Estimated PHQ-9, GAD-7, PSS scores with confidence intervals
- **Annotated Waveform**: Speech waveform with F0 contour and energy envelope analysis

**Usage:**
```python
from visualization import ClinicalVisualizationSuite

session_data = {
    'depression_score': 45,
    'anxiety_score': 35,
    'stress_score': 55,
    'stability_score': 60,
    'pitch_biomarker': 48,
    'speech_dynamics_biomarker': 52,
    ...
}

# Generate single chart
fig = ClinicalVisualizationSuite.plot_radar_biomarkers(session_data)

# Generate all clinical report graphs
figures = ClinicalVisualizationSuite.generate_clinical_report_graphs(
    session_data,
    patient_history=past_sessions
)
```

**Clinical Calibration:**
- All visualizations include citations to peer-reviewed literature
- Reference ranges based on published clinical norms
- Severity band cutoffs aligned with diagnostic criteria (PHQ-9, GAD-7, PSS)
- Confidence intervals for model predictions

### 2. Wellness Graphs (`wellness_graphs.py`)
Accessible visualizations for employee self-assessment and wellness tracking.

**Features:**
- **Wellness Wheel**: 6-dimensional wellness profile with friendly labels (Vocal Energy, Speaking Flow, Voice Steadiness, etc.)
- **Wellness Journey**: Timeline of wellness scores with zone shading and motivational messages
- **Voice Strengths**: Horizontal bar chart highlighting patient strengths
- **Weekly Patterns**: Day-by-day wellness trends with best/worst day identification
- **Breathing Rhythm**: Wave visualization of speech/pause patterns
- **Milestone Tracking**: Gamified achievement badges for engagement

**Usage:**
```python
from visualization import WellnessVisualizationSuite

session_data = {
    'energy_biomarker': 72,
    'speech_dynamics_biomarker': 68,
    'stability_score': 75,
    ...
}

# Generate wellness summary (all charts)
charts = WellnessVisualizationSuite.generate_wellness_summary(
    session_data,
    history=past_sessions
)

# Individual charts
fig1 = WellnessVisualizationSuite.plot_wellness_wheel(session_data)
fig2 = WellnessVisualizationSuite.plot_mood_timeline(past_sessions)
```

**Supportive Design:**
- Non-clinical language (no medical jargon for users)
- Warm color palette (blues, greens, purples)
- Encouraging tone ("You're doing well!", "Great progress!")
- No alarming language or red warnings
- Motivational messages based on trends

### 3. Graph to JSON (`graph_to_json.py`)
Converts visualizations to JSON format for React/web frontend integration.

**Features:**
- **Matplotlib to Base64**: Converts matplotlib figures to embeddable PNG strings
- **Plotly Interactive Charts**: Clinical and wellness charts as interactive web plots
- **JSON Serialization**: All visualizations exported as JSON for API responses
- **Web Integration**: Ready for React, D3.js, or other web visualization frameworks

**Usage:**
```python
from visualization import GraphToJSON

# Convert clinical charts to Plotly JSON
clinical_charts = GraphToJSON.all_clinical_charts_json(
    session_data,
    history=past_sessions
)

# Convert wellness charts to Plotly JSON
wellness_charts = GraphToJSON.all_wellness_charts_json(
    session_data,
    history=past_sessions
)

# API response
import json
response = {
    'clinical': clinical_charts,
    'wellness': wellness_charts,
}
api_json = json.dumps({k: GraphToJSON.figure_to_json_response(v)
                       for k, v in response.items()})
```

## Feature Mapping

The visualization suite automatically maps the 56 clinical voice biomarkers to user-friendly wellness dimensions:

| Wellness Dimension | Source Biomarkers | Clinical Meaning |
|---|---|---|
| Vocal Energy | energy_mean, energy_std | Effort, motivation, vitality |
| Speaking Flow | speech_rate, rhythm_regularity | Fluency, ease of expression |
| Voice Steadiness | jitter_local, shimmer_local | Vocal control, tension |
| Natural Pausing | pause_ratio, inter_pause_intervals | Breathing patterns, thought organization |
| Vocal Tone | f0_mean, f0_std, f0_range | Emotional range, expressivity |
| Overall Harmony | hnr, vocal_quality_biomarker | Voice quality, health |

## Clinical Reference Standards

All clinical visualizations include:

1. **PHQ-9 Equivalent Bands** (Depression)
   - Minimal: 0-9
   - Mild: 10-14
   - Moderate: 15-19
   - Severe: 20+

2. **GAD-7 Equivalent Bands** (Anxiety)
   - Minimal: 0-4
   - Mild: 5-9
   - Moderate: 10-14
   - Severe: 15+

3. **PSS-10 Equivalent Bands** (Stress)
   - Low: 0-13
   - Moderate: 14-26
   - High: 27+

4. **Population Norms** (language-specific)
   - Hindi, Telugu, Tamil, Kannada, English
   - Based on IIT Madras prosodic research
   - NIMHANS clinical prevalence data

## Dependencies

```
matplotlib>=3.7.2
seaborn>=0.12.2
plotly>=5.17.0
numpy>=1.24.3
pandas>=2.0.3
scipy>=1.11.2
```

## Integration Examples

### Django REST API
```python
from rest_framework.response import Response
from visualization import ClinicalVisualizationSuite, GraphToJSON

def clinical_report_view(request, patient_id):
    session_data = SessionData.objects.get(patient_id=patient_id)
    history = SessionData.objects.filter(patient_id=patient_id).order_by('date')

    # Generate clinical charts
    figures = ClinicalVisualizationSuite.generate_clinical_report_graphs(
        session_data.to_dict(),
        patient_history=[h.to_dict() for h in history]
    )

    # Convert to JSON for React
    charts_json = GraphToJSON.all_clinical_charts_json(
        session_data.to_dict(),
        history=[h.to_dict() for h in history]
    )

    return Response(charts_json)
```

### React Frontend
```javascript
import PlotlyChart from 'react-plotly.js';

function ClinicalDashboard({ chartData }) {
  return (
    <div>
      <PlotlyChart
        data={chartData.radar_biomarkers.data}
        layout={chartData.radar_biomarkers.layout}
      />
      <PlotlyChart
        data={chartData.longitudinal_trends.data}
        layout={chartData.longitudinal_trends.layout}
      />
    </div>
  );
}
```

### PDF Report Generation
```python
from visualization import ClinicalVisualizationSuite
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

# Generate clinical figures
figures = ClinicalVisualizationSuite.generate_clinical_report_graphs(session_data, history)

# Save to PDF
for i, fig in enumerate(figures):
    fig.savefig(f'chart_{i}.png', dpi=300, bbox_inches='tight')

# Create PDF with reportlab
c = canvas.Canvas('clinical_report.pdf', pagesize=letter)
for i, fig in enumerate(figures):
    c.drawImage(f'chart_{i}.png', 50, 400, width=500, height=400)
    c.showPage()
c.save()
```

## Customization

### Custom Color Schemes
```python
from visualization import ClinicalVisualizationSuite

# Override color scheme
CUSTOM_COLORS = {
    'normal': '#00AA00',
    'anxiety': '#FFAA00',
    'depression': '#0000AA',
    'stress': '#AA0000',
}

fig = ClinicalVisualizationSuite.plot_radar_biomarkers(
    session_data,
    custom_colors=CUSTOM_COLORS
)
```

### Custom Reference Ranges
```python
custom_norms = {
    'pitch_stability': 80,
    'speech_rate': 75,
    'pause_pattern': 70,
    ...
}

fig = ClinicalVisualizationSuite.plot_radar_biomarkers(
    session_data,
    population_norms=custom_norms
)
```

## Performance Notes

- Clinical figures suitable for 300 DPI printing (PDF reports)
- Plotly interactive charts optimized for web (< 500KB JSON)
- All visualizations render in < 5 seconds on standard hardware
- Supports batch generation for multiple patients

## Accessibility

- All charts include descriptive titles and axis labels
- Color schemes include colorblind-friendly options
- Text annotations use readable fonts (size ≥ 10pt)
- High contrast ratios for readability
- Scalable vector graphics where applicable

## Citation & References

Clinical visualization suite is based on:

1. Cummins et al. (2015) - Speech Analysis in Depression
2. Ringeval et al. (2019) - AVEC 2019 Challenge
3. Williamson et al. (2016) - DAIC-WOZ Depression Features
4. Schuller et al. (2014) - ComParE Feature Set
5. Bhatt et al. (2023) - Mental Health in India
6. NIMHANS National Mental Health Survey (2016)

## License

Vocalysis Platform - Private Research Use
All visualizations include proper scientific citations.
