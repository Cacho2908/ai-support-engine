
export async function classifyWithML(message) {
    const response = await fetch(
        'http://127.0.0.1:8000/predict',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        }
    );

    if (!response.ok) {
        throw new Error('Error al consultar Machine Learning');
    }

    const result = await response.json();

    return {
        category: result.category,
        confidence: result.confidence
    };
}
