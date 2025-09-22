Rechnungsscanner App

Eine kleine React/Vite-Anwendung, mit der Belege (Fotos oder PDFs) über die Kamera oder Dateiupload direkt an einen n8n-Webhook gesendet werden.
Ideal, um Rechnungen automatisiert in Workflows (z. B. OCR, KI-Extraktion, Buchhaltung) einzubinden.

🚀 Features

📸 Live-Kamera: Belege direkt per Webcam/Handykamera scannen

📂 Dateiupload: JPG, PNG, PDF hochladen

🔗 Direkter Webhook: Alle Dateien werden an deine n8n-Instanz geschickt

💾 Lokale Speicherung: Letzte Einträge & Einstellungen werden im Browser gespeichert

🎨 Dark/Light-Theme umschaltbar

📑 CSV-Export der erkannten Rechnungsdaten

⚙️ Installation & Setup

Repository klonen:

git clone https://github.com/step-into-ai/rechnungsscanner.git
cd rechnungsscanner
npm install
npm run dev

Dann läuft die App lokal auf http://localhost:5173

🔗 Webhook konfigurieren

Öffne die App und wechsle zum Tab „Einstellungen“.

Trage dort deine persönliche n8n-Webhook-URL ein (z. B. https://dein-server.de/webhook/rechnung).

Speichern klicken → URL wird nur lokal im Browser hinterlegt.

Ab jetzt werden alle Scans und Uploads direkt an deinen n8n-Workflow gesendet.

👉 Beispiel für einen einfachen Workflow in n8n:

Node: Webhook (POST, binary data akzeptieren)

Node: OCR / KI-Extraktion

Node: Google Sheets / Datenbank zum Speichern

🛡️ Datenschutz

Alle Einstellungen & Historie werden nur lokal im Browser gespeichert.

Es findet keine zentrale Speicherung statt.

📜 Lizenz

MIT License – feel free to use, adapt and improve.
