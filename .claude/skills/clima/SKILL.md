---
name: clima
description: Obtiene el clima actual y el pronóstico para Fernando de la Mora, Paraguay (por defecto) o para una ciudad indicada. Úsalo cuando el usuario pregunte por el clima, temperatura, lluvia o pronóstico.
argument-hint: "[ciudad opcional]"
allowed-tools: Bash(curl *)
---

# Clima local

Consulta el clima con [wttr.in](https://wttr.in) (sin API key, sin dependencias).

## Pasos

1. Ubicación: si el usuario dio una ciudad (`$ARGUMENTS`), úsala (espacios → `+`). Si no, usa por defecto `Fernando+de+la+Mora,Paraguay` (no detectar por IP).
2. Ejecuta con Bash (`curl` funciona en Windows 10+):

   ```bash
   # Resumen actual (una línea)
   curl -s "https://wttr.in/<ciudad>?format=%l:+%c+%t+(sensación+%f)+humedad+%h+viento+%w&lang=es"

   # Pronóstico 3 días (JSON, para procesar)
   curl -s "https://wttr.in/<ciudad>?format=j1&lang=es"
   ```

3. Del JSON usa: `current_condition[0]` (`temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `lang_es[0].value`) y `weather[]` (`date`, `mintempC`, `maxtempC`, `hourly[].chanceofrain`).
4. Responde en español, breve: condición, temperatura, sensación, humedad, viento, probabilidad de lluvia y pronóstico de los próximos días.

## Notas

- Unidades métricas (°C, km/h).
- Si `curl` falla o devuelve vacío/HTML, informa que el servicio no está disponible y sugiere reintentar o indicar la ciudad.
- Ubicación por defecto: Fernando de la Mora, Paraguay. Verifica que `nearest_area` del JSON coincida; si no, avísalo.
- No inventes datos.
