
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

# Cargar los 200 registros
data = pd.read_csv("ml/tickets.csv")

# Utilizar las columnas de nuestro CSV
X = data["mensaje"]
y = data["categoria"]

# Separar datos de entrenamiento y prueba
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    stratify=y,
    random_state=42
)

# Crear el modelo
model = Pipeline([
    ("vectorizer", TfidfVectorizer(ngram_range=(1, 2))),
    ("classifier", LogisticRegression(max_iter=1000))
])

# Entrenar
model.fit(X_train, y_train)

# Evaluar
predictions = model.predict(X_test)

print("Resultados del entrenamiento:")
print(classification_report(y_test, predictions))

# Guardar el modelo entrenado
joblib.dump(model, "ml/model.joblib")

print("Modelo guardado correctamente.")
