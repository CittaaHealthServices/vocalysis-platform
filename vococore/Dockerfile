FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libsndfile1 ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE $PORT

CMD gunicorn app:app --workers 4 --worker-class gthread --threads 4 --timeout 120 --bind 0.0.0.0:$PORT
