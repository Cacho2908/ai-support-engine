
from fastapi import FastAPI
from pydantic import BaseModel
import joblib

app = FastAPI()

model = joblib.load("ml/model.joblib")

class Ticket(BaseModel):
    message: str

@app.post("/predict")
def predict(ticket: Ticket):
    prediction = model.predict([ticket.message])[0]

    probabilities = model.predict_proba([ticket.message])[0]
    confidence = float(max(probabilities))

    return {
        "category": prediction,
        "confidence": confidence
    }
