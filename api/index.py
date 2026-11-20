
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pathlib import Path
import pandas as pd
import joblib
import os
from groq import Groq

app = FastAPI(title="Dashboard Kos Madiun")

# Lokasi file project
BASE_DIR = Path(__file__).resolve().parent.parent

# Memuat dataset dan model
DATA_PATH = BASE_DIR / "kos_madiun.csv"
MODEL_PATH = BASE_DIR / "model_kos.joblib"

data = pd.read_csv(DATA_PATH)
model = joblib.load(MODEL_PATH)


# Format input prediksi
class DataPrediksi(BaseModel):
    jarak_km: float
    rating: float
    ac_num: int


# Mengecek API
@app.get("/health")
def health():
    return {"status": "berhasil", "pesan": "API Dashboard Kos aktif"}


# Mengambil ringkasan dan data grafik
@app.get("/stats")
def get_stats():
    kolom = ["harga", "jarak_km", "rating", "ac_num"]

    if not all(k in data.columns for k in kolom):
        raise HTTPException(
            status_code=500,
            detail="Kolom dataset belum sesuai."
        )

    rata_ac = (
        data.groupby("ac_num")["harga"]
        .mean()
        .to_dict()
    )

    return {
        "total_data": int(len(data)),
        "rata_harga": float(data["harga"].mean() * 1000),
        "rata_jarak": float(data["jarak_km"].mean()),
        "rata_rating": float(data["rating"].mean()),
        "harga": data["harga"].tolist(),
        "jarak": data["jarak_km"].tolist(),
        "rating": data["rating"].tolist(),
        "ac": data["ac_num"].tolist(),
        "rata_ac": {
            str(k): float(v * 1000)
            for k, v in rata_ac.items()
        },
        "dataset": data.fillna("").to_dict(orient="records")
    }


# Prediksi harga kos
@app.post("/predict")
def predict(input_data: DataPrediksi):
    try:
        hasil = model.predict([[
            input_data.jarak_km,
            input_data.rating,
            input_data.ac_num
        ]])

        harga = float(hasil[0]) * 1000

        return {
            "prediksi": harga,
            "pesan": "Prediksi harga berhasil"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Penjelasan grafik menggunakan Groq AI
class DataPenjelasan(BaseModel):
    nama_grafik: str
    informasi: str


@app.post("/explain")
def explain(input_data: DataPenjelasan):
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY belum diatur di Vercel."
        )

    try:
        client = Groq(api_key=api_key)

        hasil = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Kamu adalah asisten analisis data kos Madiun. "
                        "Jelaskan grafik dengan bahasa Indonesia sederhana, "
                        "singkat, dan mudah dipahami mahasiswa."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Nama grafik: {input_data.nama_grafik}\n"
                        f"Informasi data: {input_data.informasi}\n"
                        "Berikan penjelasan singkat berdasarkan informasi tersebut."
                    )
                }
            ],
            temperature=0.5
        )

        return {
            "penjelasan": hasil.choices[0].message.content
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
