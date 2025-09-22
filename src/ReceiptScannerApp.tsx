import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import LogoBadge from "./assets/Kassenbon.png";

type ThemeId = "dark" | "light";

type ThemeConfig = {
  id: ThemeId;
  label: string;
  appBackground: string;
  cardBackground: string;
  borderColor: string;
  subtleBorder: string;
  primaryButton: string;
  secondaryButton: string;
  dangerButton: string;
  input: string;
  tableHeader: string;
  tableDivider: string;
  badgeSuccess: string;
  badgeError: string;
  badgeInfo: string;
  mutedText: string;
  tabActive: string;
  tabInactive: string;
};

type Settings = {
  webhookUrl: string;
  theme: ThemeId;
};

type Entry = {
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  totalAmount: string;
  imageName: string;
  capturedAt: string;
};

type UploadLogEntry = {
  id: string;
  fileName: string;
  displayName: string;
  status: "pending" | "success" | "error";
  timestamp: string;
  message?: string;
};

const STORAGE_KEYS = {
  entries: "receipt-scanner-entries",
  settings: "receipt-scanner-settings",
};

const DEFAULT_SETTINGS: Settings = {
  webhookUrl: "",
  theme: "dark",
};

const THEMES: Record<ThemeId, ThemeConfig> = {
  dark: {
    id: "dark",
    label: "Dunkel",
    appBackground: "bg-slate-950 text-slate-100",
    cardBackground: "bg-slate-900/60 backdrop-blur-xl",
    borderColor: "border-white/10",
    subtleBorder: "border-white/5",
    primaryButton: "bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-lg shadow-sky-500/25",
    secondaryButton: "bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10",
    dangerButton: "bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white shadow-md shadow-rose-500/30",
    input: "bg-white/5 border-white/10 text-slate-100 placeholder-white/40 focus:ring-2 focus:ring-sky-500/60 focus:border-transparent",
    tableHeader: "bg-white/5",
    tableDivider: "border-white/10",
    badgeSuccess: "bg-emerald-500/20 text-emerald-100 border border-emerald-400/50",
    badgeError: "bg-rose-500/20 text-rose-100 border border-rose-400/50",
    badgeInfo: "bg-sky-500/20 text-sky-100 border border-sky-400/50",
    mutedText: "text-slate-300",
    tabActive: "border border-transparent bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/30",
    tabInactive: "bg-white/10 text-slate-300 border border-white/10 hover:bg-white/15",
  },
  light: {
    id: "light",
    label: "Hell",
    appBackground: "bg-white text-slate-900",
    cardBackground: "bg-white/80 backdrop-blur-xl",
    borderColor: "border-slate-200/80",
    subtleBorder: "border-slate-200/60",
    primaryButton: "bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-lg shadow-sky-500/25",
    secondaryButton: "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200",
    dangerButton: "bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white shadow-md shadow-rose-500/25",
    input: "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-400 focus:border-transparent",
    tableHeader: "bg-slate-100/80",
    tableDivider: "border-slate-200/70",
    badgeSuccess: "bg-emerald-100 text-emerald-700 border border-emerald-300",
    badgeError: "bg-rose-100 text-rose-700 border border-rose-300",
    badgeInfo: "bg-sky-100 text-sky-700 border border-sky-300",
    mutedText: "text-slate-600",
    tabActive: "border border-transparent bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/25",
    tabInactive: "bg-white/80 text-slate-500 border border-slate-200 shadow-sm hover:text-slate-700",
  },
};

function formatCurrency(value: string | number | null | undefined) {
  const number = parseFloat(String(value ?? "").replace(",", "."));
  if (Number.isNaN(number)) return "N/A";
  return number.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(isoDate: string | null | undefined) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return "N/A";
  const [year, month, day] = isoDate.split("T")[0]?.split("-") ?? [];
  if (!year || !month || !day) return "N/A";
  return `${day}.${month}.${year}`;
}

function parseGermanDate(dateString: string | null | undefined) {
  if (!dateString) return null;
  const parts = dateString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!parts) return null;
  let [, day, month, year] = parts;
  day = day.padStart(2, "0");
  month = month.padStart(2, "0");
  if (year.length === 2) year = `20${year}`;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    date.getFullYear() !== Number.parseInt(year, 10) ||
    date.getMonth() + 1 !== Number.parseInt(month, 10) ||
    date.getDate() !== Number.parseInt(day, 10)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

function entriesToCSV(entries: Entry[]) {
  const header = ["Lieferant", "Rechnungsnummer", "Datum", "Betrag"];
  const rows = entries.map((entry) => [
    entry.vendor || "",
    entry.invoiceNumber || "",
    formatDate(entry.invoiceDate),
    String(entry.totalAmount ?? "").replace(".", ","),
  ]);
  const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csvLines = [header, ...rows].map((row) => row.map((cell) => escapeCell(String(cell))).join(";"));
  return csvLines.join("\n");
}

function validateWebhookUrl(url: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch (error) {
    return false;
  }
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const decimals = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

type EditableEntryRowProps = {
  entry: Entry;
  onSave: (entry: Entry) => void;
  onDelete: (id: string) => void;
  theme: ThemeConfig;
};

function EditableEntryRow({ entry, onSave, onDelete, theme }: EditableEntryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({
    vendor: entry.vendor || "",
    invoiceNumber: entry.invoiceNumber || "",
    invoiceDate: formatDate(entry.invoiceDate),
    totalAmount: entry.totalAmount || "",
  });
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft({
        vendor: entry.vendor || "",
        invoiceNumber: entry.invoiceNumber || "",
        invoiceDate: formatDate(entry.invoiceDate),
        totalAmount: entry.totalAmount || "",
      });
      setDateError(null);
    }
  }, [entry, isEditing]);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setDraft((prev) => ({ ...prev, [name]: value }));
    if (name === "invoiceDate") {
      setDateError(null);
    }
  };

  const handleSave = () => {
    const parsedDate = draft.invoiceDate ? parseGermanDate(draft.invoiceDate) : null;
    if (draft.invoiceDate && !parsedDate) {
      setDateError("Bitte Datum als TT.MM.JJJJ eintragen");
      return;
    }
    onSave({
      ...entry,
      vendor: draft.vendor,
      invoiceNumber: draft.invoiceNumber,
      invoiceDate: parsedDate,
      totalAmount: draft.totalAmount,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDateError(null);
    setDraft({
      vendor: entry.vendor || "",
      invoiceNumber: entry.invoiceNumber || "",
      invoiceDate: formatDate(entry.invoiceDate),
      totalAmount: entry.totalAmount || "",
    });
  };

  if (isEditing) {
    return (
      <tr className={theme.cardBackground}>
        <td className="p-2 align-middle">
          <input
            name="vendor"
            value={draft.vendor}
            onChange={handleChange}
            className={`w-full rounded-md border px-2 py-1 text-sm ${theme.input}`}
          />
        </td>
        <td className="p-2 align-middle">
          <input
            name="invoiceNumber"
            value={draft.invoiceNumber}
            onChange={handleChange}
            className={`w-full rounded-md border px-2 py-1 text-sm ${theme.input}`}
          />
        </td>
        <td className="p-2 align-middle">
          <input
            name="invoiceDate"
            value={draft.invoiceDate}
            onChange={handleChange}
            placeholder="TT.MM.JJJJ"
            className={`w-full rounded-md border px-2 py-1 text-sm ${theme.input} ${
              dateError ? "border-red-500" : ""
            }`}
          />
          {dateError && <p className="mt-1 text-xs text-red-400">{dateError}</p>}
        </td>
        <td className="p-2 align-middle">
          <input
            name="totalAmount"
            value={draft.totalAmount}
            onChange={handleChange}
            className={`w-full rounded-md border px-2 py-1 text-sm ${theme.input}`}
          />
        </td>
        <td className="p-2 align-middle">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleSave}
              className={`rounded-md px-3 py-1 text-sm font-medium ${theme.primaryButton}`}
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className={`rounded-md px-3 py-1 text-sm font-medium ${theme.secondaryButton}`}
            >
              Abbrechen
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-b ${theme.tableDivider}`}>
      <td className="p-2 align-middle text-sm sm:text-base">{entry.vendor || "N/A"}</td>
      <td className="p-2 align-middle text-sm sm:text-base">{entry.invoiceNumber || "N/A"}</td>
      <td className="p-2 align-middle text-sm sm:text-base">{formatDate(entry.invoiceDate)}</td>
      <td className="p-2 align-middle text-sm sm:text-base">{formatCurrency(entry.totalAmount)}</td>
      <td className="p-2 align-middle">
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${theme.secondaryButton}`}
          >
            Bearbeiten
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.capturedAt)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${theme.dangerButton}`}
          >
            Löschen
          </button>
        </div>
      </td>
    </tr>
  );
}

// +++ NEUE KOMPONENTE +++
type EditEntrySheetProps = {
  entry: Entry;
  onSave: (entry: Entry) => void;
  onClose: () => void;
  theme: ThemeConfig;
};

function EditEntrySheet({ entry, onSave, onClose, theme }: EditEntrySheetProps) {
  const [draft, setDraft] = useState({
    vendor: entry.vendor || "",
    invoiceNumber: entry.invoiceNumber || "",
    invoiceDate: formatDate(entry.invoiceDate),
    totalAmount: entry.totalAmount || "",
  });
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    setDraft({
      vendor: entry.vendor || "",
      invoiceNumber: entry.invoiceNumber || "",
      invoiceDate: formatDate(entry.invoiceDate),
      totalAmount: entry.totalAmount || "",
    });
    setDateError(null);
  }, [entry]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setDraft((prev) => ({ ...prev, [name]: value }));
    if (name === "invoiceDate") {
      setDateError(null);
    }
  };

  const handleSave = () => {
    const parsedDate = draft.invoiceDate ? parseGermanDate(draft.invoiceDate) : null;
    if (draft.invoiceDate && !parsedDate) {
      setDateError("Bitte Datum als TT.MM.JJJJ eintragen");
      return;
    }
    onSave({
      ...entry,
      vendor: draft.vendor,
      invoiceNumber: draft.invoiceNumber,
      invoiceDate: parsedDate,
      totalAmount: draft.totalAmount,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className={`w-full max-w-md rounded-2xl border ${theme.borderColor} ${theme.cardBackground} p-4 sm:p-6`}>
        <h2 className="text-lg font-semibold">Eintrag bearbeiten</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className={`block text-sm font-medium ${theme.mutedText}`}>Lieferant</label>
            <input
              name="vendor"
              value={draft.vendor}
              onChange={handleChange}
              className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${theme.input}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme.mutedText}`}>Rechnungsnummer</label>
            <input
              name="invoiceNumber"
              value={draft.invoiceNumber}
              onChange={handleChange}
              className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${theme.input}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme.mutedText}`}>Datum</label>
            <input
              name="invoiceDate"
              value={draft.invoiceDate}
              onChange={handleChange}
              placeholder="TT.MM.JJJJ"
              className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${theme.input} ${dateError ? "border-red-500" : ""}`}
            />
            {dateError && <p className="mt-1 text-xs text-red-400">{dateError}</p>}
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme.mutedText}`}>Betrag</label>
            <input
              name="totalAmount"
              value={draft.totalAmount}
              onChange={handleChange}
              className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${theme.input}`}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleSave}
            className={`rounded-md px-3 py-1 text-sm font-medium ${theme.primaryButton}`}
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md px-3 py-1 text-sm font-medium ${theme.secondaryButton}`}
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
// +++ ENDE NEUE KOMPONENTE +++

type UploadHistoryProps = {
  items: UploadLogEntry[];
  theme: ThemeConfig;
  onRename: (id: string) => void;
  onRemove: (id: string) => void;
};

function UploadHistory({ items, theme, onRename, onRemove }: UploadHistoryProps) {
  if (!items.length) return null;
  return (
    <div className={`rounded-3xl border ${theme.borderColor} ${theme.cardBackground} p-5 sm:p-6 shadow-glass`}>
      <h3 className="text-base font-semibold">Upload-Historie</h3>
      <p className={`mt-1 text-xs ${theme.mutedText}`}>
        Die letzten Dateien werden nur lokal angezeigt.
      </p>
      <ul className="mt-3 space-y-3 text-sm">
        {items.map((item) => {
          const badgeClass =
            item.status === "success"
              ? theme.badgeSuccess
              : item.status === "error"
              ? theme.badgeError
              : theme.badgeInfo;
          const label =
            item.status === "success"
              ? "Erfolgreich"
              : item.status === "error"
              ? "Fehlgeschlagen"
              : "In Arbeit";
          const icon =
            item.status === "success"
              ? "✓"
              : item.status === "error"
              ? "⚠"
              : "⏳";
          const displayName = item.displayName || item.fileName;
          const formattedTime = new Date(item.timestamp).toLocaleString("de-DE");
          return (
            <li
              key={item.id}
              className={`rounded-2xl border ${theme.subtleBorder} ${theme.cardBackground} p-4 shadow-lg shadow-black/5`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{displayName}</p>
                  <p className={`text-xs ${theme.mutedText}`}>{formattedTime}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
                  >
                    <span className="text-sm">{icon}</span>
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRename(item.id)}
                    className={`inline-flex items-center justify-center rounded-full border ${theme.subtleBorder} px-2.5 py-1 text-xs ${theme.mutedText} hover:opacity-80`}
                    title="Umbenennen"
                  >
                    Umbenennen
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className={`inline-flex items-center justify-center rounded-full border ${theme.subtleBorder} px-2.5 py-1 text-xs ${theme.mutedText} hover:opacity-80`}
                    title="Entfernen"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type CameraViewProps = {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  onError?: (message: string) => void;
  theme: ThemeConfig;
};

function CameraView({ onCapture, onClose, onError, theme }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let active = true;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current && active) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (cameraError) {
        const message = "Kamera konnte nicht gestartet werden.";
        setError(message);
        if (onError) onError(message);
      }
    }

    startCamera();

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onError]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      const message = "Keine gueltige Videoaufnahme verfuegbar.";
      setError(message);
      if (onError) onError(message);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      const message = "Canvas Kontext konnte nicht erstellt werden.";
      setError(message);
      if (onError) onError(message);
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          const message = "Aufnahme konnte nicht erstellt werden.";
          setError(message);
          if (onError) onError(message);
          return;
        }
        onCapture(blob);
        onClose();
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className={`w-full max-w-md rounded-2xl border ${theme.borderColor} ${theme.cardBackground} p-4 sm:p-6`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Live Scan</h2>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md px-3 py-1 text-sm font-medium ${theme.secondaryButton}`}
          >
            Schließen
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-black/20">
          <video ref={videoRef} playsInline className="h-64 w-full bg-black object-cover" />
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleCapture}
          className={`mt-4 w-full rounded-md px-4 py-2 text-base font-semibold ${theme.primaryButton}`}
        >
          Foto aufnehmen
        </button>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

type SettingsViewProps = {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  theme: ThemeConfig;
};

function SettingsView({ settings, onSettingsChange, theme }: SettingsViewProps) {
  const [webhookInput, setWebhookInput] = useState(settings.webhookUrl);
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(settings.theme || DEFAULT_SETTINGS.theme);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWebhookInput(settings.webhookUrl);
    setSelectedTheme(settings.theme || DEFAULT_SETTINGS.theme);
  }, [settings]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = webhookInput.trim();
    if (!validateWebhookUrl(trimmed)) {
      setError("Bitte gueltige URL eingeben (https://...).");
      setFeedback(null);
      return;
    }
    setError(null);
    const nextSettings: Settings = { webhookUrl: trimmed, theme: selectedTheme };
    onSettingsChange(nextSettings);
    setFeedback("Einstellungen gespeichert. Webhook wird nur lokal hinterlegt.");
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className={`rounded-3xl border ${theme.borderColor} ${theme.cardBackground} p-6 sm:p-8 shadow-glass`}>
        <h2 className="text-lg font-semibold">Webhook Konfiguration</h2>
        <p className={`mt-1 text-sm ${theme.mutedText}`}>
          Gib hier deinen persönlichen n8n Webhook an. Die Adresse wird nur lokal gespeichert.
        </p>
        <label className="mt-4 block text-sm font-medium">
          Webhook URL
          <input
            type="url"
            value={webhookInput}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setWebhookInput(event.target.value)}
            placeholder="https://dein-n8n-endpunkt"
            className={`mt-2 w-full rounded-md border px-3 py-2 text-base ${theme.input}`}
            required
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      <div className={`rounded-3xl border ${theme.borderColor} ${theme.cardBackground} p-6 sm:p-8 shadow-glass`}>
        <h2 className="text-lg font-semibold">Design Auswahl</h2>
        <p className={`mt-1 text-sm ${theme.mutedText}`}>
          Wähle, welches Erscheinungsbild du bevorzugst. Die Auswahl wird gespeichert.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Object.values(THEMES).map((themeOption) => {
            const isActive = selectedTheme === themeOption.id;
            return (
              <button
                key={themeOption.id}
                type="button"
                onClick={() => setSelectedTheme(themeOption.id)}
                className={`rounded-lg border px-4 py-3 text-left ${
                  isActive ? `border-blue-500 ring-2 ring-blue-400` : theme.subtleBorder
                } ${theme.cardBackground}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">{themeOption.label}</span>
                  {isActive && <span className="text-sm font-medium text-blue-400">Aktiv</span>}
                </div>
                <p className={`mt-2 text-sm ${theme.mutedText}`}>
                  {themeOption.id === "dark"
                    ? "Perfekt für abgedunkelte Umgebungen."
                    : "Helle Variante mit hoher Lesbarkeit."}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          className={`rounded-md px-5 py-2 text-base font-semibold ${theme.primaryButton}`}
        >
          Speichern
        </button>
        {feedback && <span className={`text-sm ${theme.mutedText}`}>{feedback}</span>}
      </div>
    </form>
  );
}
type ScanViewProps = {
  theme: ThemeConfig;
  entries: Entry[];
  csvBlobUrl: string | null;
  onUpdateEntry: (entry: Entry) => void;
  onDeleteEntry: (id: string) => void;
  onDeleteAll: () => void;
  onFileSelected: (file: File) => void;
  onCameraRequested: () => void;
  webhookConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  onDismissError: () => void;
  lastResult: Entry | null;
  lastPreviewUrl: string | null;
  uploadLog: UploadLogEntry[];
  onRenameUploadLog: (id: string) => void;
  onRemoveUploadLog: (id: string) => void;
  onStartEdit: (entry: Entry) => void;
};

function ScanView({
  theme,
  entries,
  csvBlobUrl,
  onUpdateEntry,
  onDeleteEntry,
  onDeleteAll,
  onFileSelected,
  onCameraRequested,
  webhookConfigured,
  isLoading,
  error,
  onDismissError,
  lastResult,
  lastPreviewUrl,
  uploadLog,
  onRenameUploadLog,
  onRemoveUploadLog,
  onStartEdit,
}: ScanViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDarkTheme = theme.id === "dark";
  const pillStyle = isDarkTheme
    ? "border border-white/10 bg-white/10 text-slate-200"
    : "border border-slate-200 bg-white text-slate-600";
  const accentBubble = isDarkTheme ? "bg-white/12 text-white" : "bg-slate-100 text-slate-600";
  const detailTone = isDarkTheme ? "text-slate-200/80" : "text-slate-500";

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    event.target.value = "";
  };

  return (
    <div className="space-y-8">
      <div className={`rounded-3xl border ${theme.borderColor} ${theme.cardBackground} p-6 sm:p-8 shadow-glass`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Scannen &amp; Hochladen</h2>
            <p className={`text-sm leading-relaxed ${theme.mutedText}`}>
              Lade Fotos oder PDFs hoch oder nutze die Kamera. Die Dateien werden direkt an deinen Webhook gesendet.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.3em]">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${pillStyle}`}>
                Nur lokal
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${pillStyle}`}>
                Direkter Webhook
              </span>
            </div>
          </div>
          <div className="hidden h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 via-indigo-500 to-purple-500 shadow-lg shadow-sky-500/40 lg:flex">
            <img src={LogoBadge} alt="Rechnungsscanner Logo" className="h-16 w-16 object-contain drop-shadow-lg" />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!webhookConfigured || isLoading}
            className={`group flex w-full flex-col gap-3 rounded-2xl px-5 py-4 text-left text-base font-semibold transition-all duration-200 ${theme.secondaryButton} ${
              (!webhookConfigured || isLoading) && "cursor-not-allowed opacity-60"
            } ${
              webhookConfigured && !isLoading ? "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/20" : ""
            } sm:flex-row sm:items-center sm:justify-between`}
          >
            <div className="flex items-center gap-4">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accentBubble}`}>
                <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V6.75" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 10.5 12 6.75 15.75 10.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 16.5v2.25A1.5 1.5 0 0 0 6.75 20.25h10.5a1.5 1.5 0 0 0 1.5-1.5V16.5" />
                </svg>
              </span>
              <div className="flex flex-col gap-0.5 text-left">
                <span>Datei auswählen</span>
                <span className={`text-xs ${detailTone}`}>JPEG, PNG oder PDF</span>
              </div>
            </div>
            <span className={`inline-flex items-center justify-center self-start rounded-full border ${theme.subtleBorder} px-3 py-1 text-xs font-semibold ${detailTone} sm:self-auto`}>
              Hochladen
            </span>
          </button>
          <button
            type="button"
            onClick={onCameraRequested}
            disabled={!webhookConfigured || isLoading}
            className={`group flex w-full flex-col gap-3 rounded-2xl px-5 py-4 text-left text-base font-semibold transition-all duration-200 ${theme.primaryButton} ${
              (!webhookConfigured || isLoading) && "cursor-not-allowed opacity-60"
            } ${
              webhookConfigured && !isLoading ? "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/20" : ""
            } sm:flex-row sm:items-center sm:justify-between`}
          >
            <div className="flex items-center gap-4">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accentBubble}`}>
                <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h2.25l1.5-2.25h8.5l1.5 2.25h2.25A1.5 1.5 0 0 1 21 9v8.25A1.5 1.5 0 0 1 19.5 18.75H4.5A1.5 1.5 0 0 1 3 17.25V9A1.5 1.5 0 0 1 4.5 7.5Z" />
                  <circle cx="12" cy="13.5" r="3.25" />
                </svg>
              </span>
              <div className="flex flex-col gap-0.5 text-left">
                <span>Kamera starten</span>
                <span className={`text-xs ${detailTone}`}>Ideal für schnelle Scans</span>
              </div>
            </div>
            <span className={`inline-flex items-center justify-center self-start rounded-full border ${theme.subtleBorder} px-3 py-1 text-xs font-semibold ${detailTone} sm:self-auto`}>
              Live
            </span>
          </button>
        </div>

        {!webhookConfigured && (
          <div className={`mt-6 rounded-2xl border border-dashed ${theme.subtleBorder} px-4 py-4 text-sm font-medium ${detailTone}`}>
            Hinterlege zuerst deinen Webhook in den Einstellungen, damit Uploads funktionieren.
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileInputChange}
        />
        {isLoading && (
          <div className="mt-6 inline-flex items-center gap-3 text-sm font-medium text-sky-400">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-400/80" />
            Verarbeite Datei...
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-2xl border border-rose-400/50 bg-rose-500/10 px-4 py-4 text-sm font-medium text-rose-200 shadow-lg shadow-rose-500/20">
            <div className="flex items-start justify-between gap-4">
              <span>{error}</span>
              <button type="button" onClick={onDismissError} className="text-xs font-semibold">
                Schließen
              </button>
            </div>
          </div>
        )}
      </div>

      {lastResult && (
        <div className={`rounded-3xl border ${theme.borderColor} ${theme.cardBackground} p-6 sm:p-8 shadow-glass`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold tracking-tight">Letztes Ergebnis</h3>
            <span className={`inline-flex items-center gap-2 rounded-full border ${theme.subtleBorder} px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${detailTone}`}>
              Neu hinzugefuegt
            </span>
          </div>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Lieferant</p>
              <p className={`mt-1 text-base font-medium ${theme.mutedText}`}>{lastResult.vendor || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Rechnungsnr.</p>
              <p className={`mt-1 text-base font-medium ${theme.mutedText}`}>{lastResult.invoiceNumber || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Datum</p>
              <p className={`mt-1 text-base font-medium ${theme.mutedText}`}>{formatDate(lastResult.invoiceDate)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Betrag</p>
              <p className={`mt-1 text-base font-medium ${theme.mutedText}`}>{formatCurrency(lastResult.totalAmount)}</p>
            </div>
          </div>
          {lastPreviewUrl && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              <img src={lastPreviewUrl} alt="Letzter Scan" className="h-48 w-full object-cover" />
            </div>
          )}
        </div>
      )}

      <UploadHistory items={uploadLog} theme={theme} onRename={onRenameUploadLog} onRemove={onRemoveUploadLog} />

      <div className={`rounded-3xl border ${theme.borderColor} ${theme.cardBackground} p-6 sm:p-8 shadow-glass`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold tracking-tight">Gespeicherte Einträge ({entries.length})</h3>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <a
              href={csvBlobUrl ?? "#"}
              download="rechnungen.csv"
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-base font-semibold ${theme.primaryButton} ${
                !entries.length && "cursor-not-allowed opacity-60"
              }`}
              aria-disabled={!entries.length}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">CSV</span>
              Export
            </a>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={onDeleteAll}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-base font-semibold ${theme.dangerButton}`}
              >
                Alles löschen
              </button>
            )}
          </div>
        </div>
        <div className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 hidden sm:block">
          <table className="min-w-[700px] sm:min-w-full text-left text-sm">
            <thead className={`text-[11px] uppercase tracking-[0.35em] ${theme.tableHeader}`}>
              <tr>
                <th className="px-4 py-3">Lieferant</th>
                <th className="px-4 py-3">Rechnungsnr.</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Betrag</th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <EditableEntryRow
                  key={entry.capturedAt}
                  entry={entry}
                  onSave={onUpdateEntry}
                  onDelete={onDeleteEntry}
                  theme={theme}
                />
              ))}
              {!entries.length && (
                <tr>
                  <td colSpan={5} className={`px-4 py-6 text-center text-sm ${theme.mutedText}`}>
                    Noch keine Einträge vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid gap-3 sm:hidden">
          {entries.map((entry) => (
            <div key={entry.capturedAt} className={`rounded-2xl border ${theme.subtleBorder} ${theme.cardBackground} p-4 shadow-lg shadow-black/5`}>
              <div className="space-y-3 text-sm">
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.3em] ${theme.mutedText}`}>Lieferant</p>
                  <p className="text-base font-medium">{entry.vendor || 'N/A'}</p>
                </div>
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.3em] ${theme.mutedText}`}>Rechnungsnr.</p>
                  <p className="text-base font-medium">{entry.invoiceNumber || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.3em] ${theme.mutedText}`}>Datum</p>
                    <p className="text-base font-medium">{formatDate(entry.invoiceDate)}</p>
                  </div>
                  <div>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.3em] ${theme.mutedText}`}>Betrag</p>
                    <p className="text-base font-medium">{formatCurrency(entry.totalAmount)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                {/* +++ ÄNDERUNG HIER +++ */}
                <button type="button" onClick={() => onStartEdit(entry)} className={`inline-flex items-center rounded-full border ${theme.subtleBorder} px-3 py-1 text-xs font-semibold ${theme.mutedText} hover:opacity-80`}>Bearbeiten</button>
                <button type="button" onClick={() => onDeleteEntry(entry.capturedAt)} className={`inline-flex items-center rounded-full border ${theme.subtleBorder} px-3 py-1 text-xs font-semibold ${theme.mutedText} hover:opacity-80`}>Löschen</button>
              </div>
            </div>
          ))}
          {!entries.length && (
            <div className={`rounded-2xl border ${theme.subtleBorder} ${theme.cardBackground} p-4 text-center text-sm ${theme.mutedText}`}>
              Noch keine Einträge vorhanden.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function ReceiptScannerApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeTab, setActiveTab] = useState<"scan" | "settings">("scan");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Entry | null>(null);
  const [lastPreviewUrl, setLastPreviewUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [uploadLog, setUploadLog] = useState<UploadLogEntry[]>([]);
  // +++ NEUER STATE +++
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const theme = THEMES[settings.theme] || THEMES.dark;
  const isDarkTheme = settings.theme === "dark";

  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEYS.settings);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as Partial<Settings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (storageError) {
      console.error("Settings konnten nicht gelesen werden.", storageError);
    }
  }, []);

  useEffect(() => {
    try {
      const storedEntries = localStorage.getItem(STORAGE_KEYS.entries);
      if (storedEntries) {
        const parsed = JSON.parse(storedEntries);
        if (Array.isArray(parsed)) {
          setEntries(parsed as Entry[]);
        }
      }
    } catch (storageError) {
      console.error("Einträge konnten nicht gelesen werden.", storageError);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    return () => {
      if (lastPreviewUrl) {
        URL.revokeObjectURL(lastPreviewUrl);
      }
    };
  }, [lastPreviewUrl]);

  const csvBlobUrl = useMemo(() => {
    if (!entries.length) return null;
    const blob = new Blob([entriesToCSV(entries)], {
      type: "text/csv;charset=utf-8;",
    });
    return URL.createObjectURL(blob);
  }, [entries]);

  useEffect(() => {
    return () => {
      if (csvBlobUrl) URL.revokeObjectURL(csvBlobUrl);
    };
  }, [csvBlobUrl]);

  const handleSettingsChange = (nextSettings: Settings) => {
    setSettings((prev) => ({ ...prev, ...nextSettings }));
  };

  const updateUploadLog = (entry: Partial<UploadLogEntry> & { id: string; fileName?: string }) => {
    setUploadLog((prev) => {
      const existing = prev.find((item) => item.id === entry.id);
      const next: UploadLogEntry = {
        id: entry.id,
        fileName: entry.fileName ?? existing?.fileName ?? "",
        displayName:
          entry.displayName ?? existing?.displayName ?? entry.fileName ?? existing?.fileName ?? "",
        status: entry.status ?? existing?.status ?? "pending",
        timestamp: entry.timestamp ?? existing?.timestamp ?? new Date().toISOString(),
        message: entry.message ?? existing?.message,
      };
      const filtered = prev.filter((item) => item.id !== entry.id);
      return [next, ...filtered].slice(0, 5);
    });
  };

  const handleRenameUploadLog = (id: string) => {
    if (typeof window === "undefined") return;
    setUploadLog((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;
      const currentName = (target.displayName || target.fileName || '').trim();
      const nextName = window.prompt("Neuer Name für den Upload", currentName);
      if (nextName === null) return prev;
      const trimmed = nextName.trim();
      if (!trimmed) return prev;
      return prev.map((item) =>
        item.id === id ? { ...item, displayName: trimmed } : item
      );
    });
  };

  const handleRemoveUploadLog = (id: string) => {
    setUploadLog((prev) => prev.filter((item) => item.id !== id));
  };
  
  const processFile = async (file: File) => {
    if (!settings.webhookUrl) {
      setError("Kein Webhook hinterlegt. Bitte Einstellungen prüfen.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const logId = `${Date.now()}-${file.name}`;
    const fileType = file.type || "application/octet-stream";
    const fileSizeLabel = formatFileSize(file.size);
    const metaLabel = `${fileType} | ${fileSizeLabel}`;

    updateUploadLog({
      id: logId,
      fileName: file.name,
      displayName: file.name,
      status: "pending",
      timestamp: new Date().toISOString(),
      message: `Upload gestartet (${metaLabel})`,
    });

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("fileName", file.name);
      formData.append("mimeType", fileType);
      formData.append("fileSize", String(file.size));
      formData.append("fileSizeReadable", fileSizeLabel);

      const response = await fetch(settings.webhookUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Webhook antwortete mit Status ${response.status}`);
      }

      let payload: any;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = await response.json();
      } else {
        const text = await response.text();
        if (!text) {
          throw new Error("Server lieferte eine leere Antwort.");
        }
        try {
          payload = JSON.parse(text);
        } catch (parseError) {
          throw new Error("Antwort konnte nicht als JSON gelesen werden.");
        }
      }

      const newEntry: Entry = {
        vendor: payload?.vendor || "",
        invoiceNumber: payload?.invoiceNumber || "",
        invoiceDate: payload?.invoiceDate || "",
        totalAmount: payload?.totalAmount || "0",
        imageName: file.name,
        capturedAt: new Date().toISOString(),
      };

      setEntries((prev) => [newEntry, ...prev]);
      setLastResult(newEntry);

      if (lastPreviewUrl) {
        URL.revokeObjectURL(lastPreviewUrl);
      }
      const previewUrl = URL.createObjectURL(file);
      setLastPreviewUrl(previewUrl);

      updateUploadLog({
        id: logId,
        fileName: file.name,
        status: "success",
        timestamp: new Date().toISOString(),
        message: `Scan erfolgreich verarbeitet (${metaLabel})`,
      });
    } catch (uploadError) {
      console.error(uploadError);
      const errorMessage = uploadError instanceof Error ? uploadError.message : "Unbekannter Fehler";
      setError(errorMessage);
      updateUploadLog({
        id: logId,
        fileName: file.name,
        status: "error",
        timestamp: new Date().toISOString(),
        message: `${metaLabel} | ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelected = (file: File) => {
    processFile(file);
  };

  const handleCameraCapture = (blob: Blob) => {
    const fileName = `scan_${Date.now()}.jpg`;
    const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });
    processFile(file);
  };

  const handleUpdateEntry = (updatedEntry: Entry) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.capturedAt === updatedEntry.capturedAt ? { ...entry, ...updatedEntry } : entry
      )
    );
    setLastResult((prev) =>
      prev && prev.capturedAt === updatedEntry.capturedAt ? { ...prev, ...updatedEntry } : prev
    );
    setEditingEntry(null); // Schließt das Edit-Sheet nach dem Speichern
  };

  const handleDeleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.capturedAt !== id));
    setLastResult((prev) => (prev && prev.capturedAt === id ? null : prev));
  };

  const handleDeleteAll = () => {
    if (!entries.length) return;
    const confirmDelete = window.confirm(
      `Möchtest du wirklich alle ${entries.length} Einträge entfernen?`
    );
    if (!confirmDelete) return;
    setEntries([]);
    setLastResult(null);
    if (lastPreviewUrl) {
      URL.revokeObjectURL(lastPreviewUrl);
      setLastPreviewUrl(null);
    }
  };

  // +++ NEUE HANDLER +++
  const handleStartEdit = (entry: Entry) => {
    setEditingEntry(entry);
  };

  const handleCloseEdit = () => {
    setEditingEntry(null);
  };

  return (
    <div className={`relative min-h-screen ${theme.appBackground}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-soft" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-gradient-to-b from-white/60 via-white/20 to-transparent" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12 sm:px-6 lg:px-12">
        <header className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-5">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] ${
                isDarkTheme
                  ? "border border-white/10 bg-white/10 text-slate-200"
                  : "border border-slate-200/80 bg-white/80 text-slate-600"
              }`}
            >
              Digitale Belegverwaltung
            </span>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              <span className="bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
                Rechnungsscanner
              </span>
            </h1>
            <p className={`text-base ${theme.mutedText}`}>
              Schneller Workflow für deine Belege mit deinem eigenen n8n Webhook. Scannen, hochladen und archivieren in Sekunden.
            </p>
          </div>
          <nav className={`inline-flex items-center gap-2 rounded-full border ${theme.borderColor} ${theme.cardBackground} p-1 shadow-glass backdrop-blur-xl`}>
            <button
              type="button"
              onClick={() => setActiveTab("scan")}
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all duration-200 ${
                activeTab === "scan" ? theme.tabActive : theme.tabInactive
              }`}
            >
              Scannen
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all duration-200 ${
                activeTab === "settings" ? theme.tabActive : theme.tabInactive
              }`}
            >
              Einstellungen
            </button>
          </nav>
        </header>

        <div className="grid gap-6">
          {activeTab === "scan" ? (
            <ScanView
              theme={theme}
              entries={entries}
              csvBlobUrl={csvBlobUrl}
              onUpdateEntry={handleUpdateEntry}
              onDeleteEntry={handleDeleteEntry}
              onDeleteAll={handleDeleteAll}
              onFileSelected={handleFileSelected}
              onCameraRequested={() => setIsCameraOpen(true)}
              webhookConfigured={Boolean(settings.webhookUrl)}
              isLoading={isLoading}
              error={error}
              onDismissError={() => setError(null)}
              lastResult={lastResult}
              lastPreviewUrl={lastPreviewUrl}
              uploadLog={uploadLog}
              onRenameUploadLog={handleRenameUploadLog}
              onRemoveUploadLog={handleRemoveUploadLog}
              onStartEdit={handleStartEdit} // +++ PROP HINZUGEFÜGT +++
            />
          ) : (
            <SettingsView
              settings={settings}
              onSettingsChange={handleSettingsChange}
              theme={theme}
            />
          )}
        </div>
      </div>

      {isCameraOpen && (
        <CameraView
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraOpen(false)}
          onError={(message) => setError(message)}
          theme={theme}
        />
      )}
      
      {/* +++ NEUES RENDERING +++ */}
      {editingEntry && (
        <EditEntrySheet
          entry={editingEntry}
          onSave={handleUpdateEntry}
          onClose={handleCloseEdit}
          theme={theme}
        />
      )}
    </div>
  );
}

export default ReceiptScannerApp;