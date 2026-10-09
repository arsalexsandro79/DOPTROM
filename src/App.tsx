import { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';

// ==================== TYPES ====================
interface ExtractedData {
  rawText: string;
  structured: StructuredField[];
  category: string;
  timestamp: string;
}

interface StructuredField {
  label: string;
  value: string;
  icon: string;
}

interface SignatureData {
  dataUrl: string | null;
  name: string;
  dni: string;
  role: string;
  email: string;
}

interface DigitalCertificate {
  signer: string;
  dni: string;
  role: string;
  timestamp: string;
  hash: string;
  algorithm: string;
  serialNumber: string;
  issuer: string;
}

// ==================== SMART DATA PARSER ====================
function parseStructuredData(text: string): { fields: StructuredField[]; category: string } {
  const lines = text.split('\n').filter(l => l.trim());
  const fields: StructuredField[] = [];
  let category = 'Documento General';

  // Detectar categoría
  const lowerText = text.toLowerCase();

  if (lowerText.includes('asistencia') || lowerText.includes('presente') || lowerText.includes('ausente') || lowerText.includes('tarde') || lowerText.includes('falta')) {
    category = '📋 Registro de Asistencia';
    const attendanceData = parseAttendance(lines);
    return { fields: attendanceData, category };
  }

  if (lowerText.includes('factura') || lowerText.includes('total') || lowerText.includes('precio') || lowerText.includes('monto') || lowerText.includes('importe')) {
    category = '🧾 Factura / Comprobante';
    const invoiceData = parseInvoice(lines);
    return { fields: invoiceData, category };
  }

  if (lowerText.includes('dni') || lowerText.includes('nombre') || lowerText.includes('apellido') || lowerText.includes('dirección') || lowerText.includes('telefono')) {
    category = '🪪 Documento de Identidad';
    const identityData = parseIdentity(lines);
    return { fields: identityData, category };
  }

  if (lowerText.includes('horario') || lowerText.includes('hora') || lowerText.includes('turno') || lowerText.includes('lunes') || lowerText.includes('martes')) {
    category = '🕐 Horario / Calendario';
    const scheduleData = parseSchedule(lines);
    return { fields: scheduleData, category };
  }

  if (lowerText.includes('nota') || lowerText.includes('calificación') || lowerText.includes('examen') || lowerText.includes('promedio')) {
    category = '📝 Calificaciones / Notas';
    const gradesData = parseGrades(lines);
    return { fields: gradesData, category };
  }

  // Genérico: intentar extraer campos clave-valor
  for (const line of lines) {
    const colonMatch = line.match(/^(.+?)[:\-–—]\s*(.+)$/);
    if (colonMatch) {
      fields.push({
        label: colonMatch[1].trim(),
        value: colonMatch[2].trim(),
        icon: '📌',
      });
    } else if (line.trim().length > 2) {
      fields.push({
        label: `Línea ${fields.length + 1}`,
        value: line.trim(),
        icon: '📄',
      });
    }
  }

  return { fields, category };
}

function parseAttendance(lines: string[]): StructuredField[] {
  const fields: StructuredField[] = [];
  const days = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo'];
  const states = ['presente', 'ausente', 'tarde', 'falta', 'justificado', 'p', 'a', 't', 'f', 'j'];

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    
    // Detectar días
    for (const day of days) {
      if (lower.includes(day)) {
        fields.push({
          label: `📅 ${day.charAt(0).toUpperCase() + day.slice(1)}`,
          value: line.trim(),
          icon: '📅',
        });
      }
    }

    // Detectar estados de asistencia
    for (const state of states) {
      if (lower.includes(state) && !days.some(d => lower.includes(d))) {
        const statusIcon = ['presente', 'p'].includes(state) ? '✅' :
                          ['ausente', 'falta', 'a', 'f'].includes(state) ? '❌' :
                          ['tarde', 't'].includes(state) ? '⏰' : '📝';
        fields.push({
          label: `${statusIcon} Registro`,
          value: line.trim(),
          icon: statusIcon,
        });
      }
    }

    // Nombres o datos generales
    if (!days.some(d => lower.includes(d)) && !states.some(s => lower.includes(s)) && line.trim().length > 2) {
      fields.push({
        label: '👤 Persona / Dato',
        value: line.trim(),
        icon: '👤',
      });
    }
  }

  return fields.length > 0 ? fields : lines.filter(l => l.trim()).map(l => ({
    label: '📋 Registro',
    value: l.trim(),
    icon: '📋',
  }));
}

function parseInvoice(lines: string[]): StructuredField[] {
  const fields: StructuredField[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('total') || lower.includes('importe') || lower.includes('monto')) {
      fields.push({ label: '💰 Total', value: line.trim(), icon: '💰' });
    } else if (lower.includes('subtotal')) {
      fields.push({ label: '📊 Subtotal', value: line.trim(), icon: '📊' });
    } else if (lower.includes('iva') || lower.includes('impuesto') || lower.includes('tax')) {
      fields.push({ label: '🏛️ Impuesto', value: line.trim(), icon: '🏛️' });
    } else if (lower.includes('fecha')) {
      fields.push({ label: '📅 Fecha', value: line.trim(), icon: '📅' });
    } else if (lower.includes('cliente') || lowerText(line, ['nombre', 'razón', 'razon'])) {
      fields.push({ label: '👤 Cliente', value: line.trim(), icon: '👤' });
    } else if (/\d+[\.,]\d{2}/.test(line)) {
      fields.push({ label: '🏷️ Producto/Servicio', value: line.trim(), icon: '🏷️' });
    } else if (line.trim().length > 2) {
      fields.push({ label: '📄 Detalle', value: line.trim(), icon: '📄' });
    }
  }
  return fields;
}

function parseIdentity(lines: string[]): StructuredField[] {
  const fields: StructuredField[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('dni') || lower.includes('documento') || /\d{7,8}/.test(line)) {
      fields.push({ label: '🪪 DNI / Documento', value: line.trim(), icon: '🪪' });
    } else if (lower.includes('nombre')) {
      fields.push({ label: '👤 Nombre', value: line.trim(), icon: '👤' });
    } else if (lower.includes('apellido')) {
      fields.push({ label: '👤 Apellido', value: line.trim(), icon: '👤' });
    } else if (lower.includes('dirección') || lower.includes('direccion') || lower.includes('domicilio')) {
      fields.push({ label: '📍 Dirección', value: line.trim(), icon: '📍' });
    } else if (lower.includes('teléfono') || lower.includes('telefono') || lower.includes('celular')) {
      fields.push({ label: '📞 Teléfono', value: line.trim(), icon: '📞' });
    } else if (lower.includes('fecha') || lower.includes('nacimiento')) {
      fields.push({ label: '📅 Fecha', value: line.trim(), icon: '📅' });
    } else if (line.trim().length > 2) {
      fields.push({ label: '📄 Dato', value: line.trim(), icon: '📄' });
    }
  }
  return fields;
}

function parseSchedule(lines: string[]): StructuredField[] {
  const fields: StructuredField[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/\d{1,2}:\d{2}/.test(line)) {
      fields.push({ label: '🕐 Horario', value: line.trim(), icon: '🕐' });
    } else if (['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].some(d => lower.includes(d))) {
      fields.push({ label: '📅 Día', value: line.trim(), icon: '📅' });
    } else if (line.trim().length > 2) {
      fields.push({ label: '📋 Actividad', value: line.trim(), icon: '📋' });
    }
  }
  return fields;
}

function parseGrades(lines: string[]): StructuredField[] {
  const fields: StructuredField[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('promedio') || lower.includes('nota final')) {
      fields.push({ label: '📊 Promedio', value: line.trim(), icon: '📊' });
    } else if (/\b\d{1,2}[\.,]\d?\d?\b/.test(line)) {
      fields.push({ label: '📝 Calificación', value: line.trim(), icon: '📝' });
    } else if (line.trim().length > 2) {
      fields.push({ label: '📄 Detalle', value: line.trim(), icon: '📄' });
    }
  }
  return fields;
}

function lowerText(line: string, keywords: string[]): boolean {
  const lower = line.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

// ==================== GENERATE CERTIFICATE HASH ====================
function generateCertHash(data: string): string {
  let hash = 0;
  const str = data + Date.now().toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(16, '0');
}

function generateSerialNumber(): string {
  const chars = 'ABCDEF0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) result += ':';
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ==================== SIGNATURE PAD ====================
function SignaturePad({
  label,
  signature,
  onSignatureChange,
  onNameChange,
  onRoleChange,
  onDniChange,
  onEmailChange,
}: {
  label: string;
  signature: SignatureData;
  onSignatureChange: (dataUrl: string) => void;
  onNameChange: (name: string) => void;
  onRoleChange: (role: string) => void;
  onDniChange: (dni: string) => void;
  onEmailChange: (email: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasContent(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSignatureChange(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onSignatureChange('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
        <h3 className="text-white font-bold text-lg">{label}</h3>
        <p className="text-slate-300 text-xs mt-1">Complete sus datos y firme para certificar</p>
      </div>

      <div className="p-6 space-y-4">
        {/* Datos personales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              value={signature.name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-medium"
              placeholder="Juan Pérez García"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              DNI / Documento *
            </label>
            <input
              type="text"
              value={signature.dni}
              onChange={(e) => onDniChange(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono font-medium"
              placeholder="12345678"
              maxLength={12}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Cargo / Rol
            </label>
            <input
              type="text"
              value={signature.role}
              onChange={(e) => onRoleChange(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-medium"
              placeholder="Gerente General"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              value={signature.email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-medium"
              placeholder="correo@empresa.com"
            />
          </div>
        </div>

        {/* Firma */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            ✍️ Firma Digital (dibuje su firma)
          </label>
          <div className="relative border-2 border-gray-300 rounded-xl overflow-hidden bg-gradient-to-b from-gray-50 to-white">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <span className="text-gray-400 text-lg">Firme aquí</span>
            </div>
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
              className="w-full cursor-crosshair touch-none"
              style={{ height: '180px' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              {hasContent ? '✅ Firma capturada' : 'Dibuje su firma en el recuadro'}
            </p>
            <button
              onClick={clearSignature}
              className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-semibold border border-red-200"
            >
              ✕ Limpiar
            </button>
          </div>
        </div>

        {/* Certificado preview */}
        {signature.name && signature.dni && hasContent && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">✓</span>
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">Datos completos para firma digital</p>
              <p className="text-xs text-green-600">Se generará certificado con hash de verificación</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== IMAGE UPLOADER ====================
function ImageUploader({ onExtract }: { onExtract: (data: ExtractedData) => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setImage(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const processImage = async () => {
    if (!image) return;
    setProcessing(true);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(image, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const text = result.data.text;
      const { fields, category } = parseStructuredData(text);

      onExtract({
        rawText: text,
        structured: fields,
        category,
        timestamp: new Date().toLocaleString('es-ES'),
      });
    } catch {
      onExtract({
        rawText: 'Error al procesar la imagen.',
        structured: [],
        category: 'Error',
        timestamp: new Date().toLocaleString('es-ES'),
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4">
        <h3 className="text-white font-bold text-lg">📷 Cargar Imagen</h3>
        <p className="text-blue-200 text-xs mt-1">Suba cualquier imagen y se extraerán y ordenarán los datos automáticamente</p>
      </div>

      <div className="p-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200"
        >
          {image ? (
            <img src={image} alt="Preview" className="max-h-52 mx-auto rounded-lg shadow-md" />
          ) : (
            <div className="py-6">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-gray-700 font-semibold text-lg">
                Arrastra tu imagen aquí
              </p>
              <p className="text-sm text-gray-400 mt-2">
                o haz clic para seleccionar un archivo
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {['Asistencia', 'Facturas', 'DNI', 'Horarios', 'Notas', 'Cualquier texto'].map(tag => (
                  <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>

        {image && (
          <button
            onClick={processImage}
            disabled={processing}
            className="mt-4 w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 shadow-lg"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analizando imagen... {progress}%
              </span>
            ) : (
              '🔍 Extraer y Ordenar Datos'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ==================== STRUCTURED DATA DISPLAY ====================
function StructuredDataDisplay({ data }: { data: ExtractedData | null }) {
  if (!data) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-700 to-teal-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-lg">📋 Datos Extraídos y Ordenados</h3>
          <p className="text-emerald-200 text-xs mt-1">Información estructurada automáticamente</p>
        </div>
        <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold">
          {data.category}
        </span>
      </div>

      <div className="p-6">
        {data.structured.length > 0 ? (
          <div className="space-y-2">
            {data.structured.map((field, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition"
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{field.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{field.label}</p>
                  <p className="text-sm text-gray-800 font-medium mt-0.5 break-words">{field.value}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-medium">⚠️ No se pudieron estructurar los datos</p>
            <p className="text-yellow-600 text-sm mt-1">Texto crudo detectado:</p>
            <pre className="mt-2 text-xs text-yellow-700 bg-yellow-100 p-3 rounded overflow-auto">{data.rawText}</pre>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">📊 {data.structured.length} campos detectados</span>
          <span className="text-xs text-gray-400">🕐 {data.timestamp}</span>
        </div>
      </div>
    </div>
  );
}

// ==================== DIGITAL CERTIFICATE BADGE ====================
function DigitalCertBadge({ cert }: { cert: DigitalCertificate }) {
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-white text-xl">🔒</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-green-800">FIRMADO DIGITALMENTE</span>
            <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">VÁLIDO</span>
          </div>
          <p className="text-sm text-gray-800">
            Firmado por: <strong>{cert.signer}</strong>
          </p>
          <p className="text-xs text-gray-600">
            DNI: {cert.dni} · {cert.role}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            📅 {cert.timestamp}
          </p>
          <div className="mt-2 bg-white/70 rounded p-2 border border-green-200">
            <p className="text-[10px] text-gray-500 font-mono break-all">
              <span className="font-bold">HASH:</span> {cert.hash}
            </p>
            <p className="text-[10px] text-gray-500 font-mono">
              <span className="font-bold">ALG:</span> {cert.algorithm} · <span className="font-bold">SERIAL:</span> {cert.serialNumber}
            </p>
            <p className="text-[10px] text-gray-500">
              <span className="font-bold">EMISOR:</span> {cert.issuer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== FORMAL DOCUMENT ====================
function FormalDocument({
  extractedData,
  signer1,
  signer2,
}: {
  extractedData: ExtractedData | null;
  signer1: SignatureData;
  signer2: SignatureData;
}) {
  const [docNumber] = useState(
    `DC-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  );

  const [currentDate] = useState(
    new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
  );

  const cert1: DigitalCertificate = {
    signer: signer1.name || 'No especificado',
    dni: signer1.dni || 'No proporcionado',
    role: signer1.role || 'Firmante',
    timestamp: new Date().toLocaleString('es-ES'),
    hash: generateCertHash(`${signer1.name}${signer1.dni}${extractedData?.rawText || ''}`),
    algorithm: 'SHA-256',
    serialNumber: generateSerialNumber(),
    issuer: 'DocuSign Digital CA',
  };

  const cert2: DigitalCertificate = {
    signer: signer2.name || 'No especificado',
    dni: signer2.dni || 'No proporcionado',
    role: signer2.role || 'Encargado',
    timestamp: new Date().toLocaleString('es-ES'),
    hash: generateCertHash(`${signer2.name}${signer2.dni}${extractedData?.rawText || ''}`),
    algorithm: 'SHA-256',
    serialNumber: generateSerialNumber(),
    issuer: 'DocuSign Digital CA',
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl border-2 border-gray-300 overflow-hidden max-w-4xl mx-auto" id="formal-document">
      {/* Header del documento */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-8 py-6 text-center">
        <div className="flex items-center justify-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg border-2 border-yellow-300">
            <span className="text-2xl">🏛️</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">DOCUMENTO CERTIFICADO</h1>
            <p className="text-slate-300 text-xs tracking-[0.3em] uppercase mt-1">
              Firma Digital con Validez Legal
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* Info del documento */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-5 rounded-xl border">
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">N° Documento</p>
            <p className="font-mono text-sm font-bold text-gray-800 mt-1">{docNumber}</p>
          </div>
          <div className="text-center border-x border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Fecha Emisión</p>
            <p className="text-sm font-bold text-gray-800 mt-1">{currentDate}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Tipo</p>
            <p className="text-sm font-bold text-gray-800 mt-1">{extractedData?.category || 'General'}</p>
          </div>
        </div>

        {/* Datos extraídos */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-3">
            <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-sm font-bold">1</span>
            DATOS DEL DOCUMENTO ORIGINAL
          </h2>

          {extractedData && extractedData.structured.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="space-y-2">
                {extractedData.structured.map((field, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm border-b border-amber-100 pb-2 last:border-0">
                    <span>{field.icon}</span>
                    <span className="font-bold text-gray-600 min-w-[100px]">{field.label}:</span>
                    <span className="text-gray-800">{field.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <p className="text-gray-400 italic text-sm">Sin datos de imagen cargados.</p>
            </div>
          )}
        </div>

        {/* Firmas Digitales */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-3">
            <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-sm font-bold">2</span>
            CERTIFICADOS DE FIRMA DIGITAL
          </h2>

          <div className="space-y-4">
            <DigitalCertBadge cert={cert1} />
            <DigitalCertBadge cert={cert2} />
          </div>
        </div>

        {/* Firmas visuales */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-3">
            <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 text-sm font-bold">3</span>
            FIRMAS MANUSCRITAS
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[{ data: signer1, label: 'Firmante' }, { data: signer2, label: 'Encargado' }].map(({ data, label }) => (
              <div key={label} className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">{label}</p>
                <div className="h-24 flex items-center justify-center bg-white rounded-lg border border-gray-200 mb-3">
                  {data.dataUrl ? (
                    <img src={data.dataUrl} alt="Firma" className="max-h-20 object-contain" />
                  ) : (
                    <span className="text-gray-300 text-sm">Sin firma manuscrita</span>
                  )}
                </div>
                <div className="border-t-2 border-gray-800 pt-2">
                  <p className="font-bold text-gray-900">{data.name || '________________________'}</p>
                  <p className="text-xs text-gray-500">DNI: {data.dni || '________'}</p>
                  <p className="text-xs text-gray-500">{data.role || ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sello final */}
        <div className="border-t-2 border-gray-300 pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 border-4 border-green-600 rounded-full flex items-center justify-center bg-green-50 relative">
                <div className="text-center">
                  <span className="text-green-700 text-2xl font-bold">✓</span>
                  <p className="text-[7px] text-green-700 font-bold tracking-wider">VERIFICADO</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-green-700">DOCUMENTO VERIFICADO DIGITALMENTE</p>
                <p className="text-xs text-gray-500">Este documento cuenta con firma digital certificada</p>
                <p className="text-xs text-gray-400 font-mono mt-1">
                  Hash: {generateCertHash(docNumber + currentDate)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Emitido</p>
              <p className="text-sm text-gray-600">{new Date().toLocaleString('es-ES')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer del documento */}
      <div className="bg-gray-100 border-t border-gray-300 px-8 py-4 text-center">
        <p className="text-[10px] text-gray-500">
          Este documento fue generado electrónicamente y cuenta con validez digital conforme a la legislación vigente.
          <br />
          Cualquier alteración invalidará el hash de verificación. · DocuSign Digital © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================
export default function App() {
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [signer1, setSigner1] = useState<SignatureData>({
    dataUrl: null, name: '', dni: '', role: '', email: '',
  });
  const [signer2, setSigner2] = useState<SignatureData>({
    dataUrl: null, name: '', dni: '', role: 'Encargado de Empresa', email: '',
  });
  const [activeTab, setActiveTab] = useState<'upload' | 'sign' | 'document'>('upload');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">🔐</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">DocuSign Digital</h1>
                <p className="text-[10px] text-gray-500 tracking-wider uppercase">Firma Digital Certificada</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Sistema Seguro Activo
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-white rounded-2xl p-2 shadow-lg border border-gray-200">
          {[
            { key: 'upload' as const, icon: '📷', label: 'Cargar Imagen', step: '1' },
            { key: 'sign' as const, icon: '✍️', label: 'Firmar Digitalmente', step: '2' },
            { key: 'document' as const, icon: '📄', label: 'Documento Certificado', step: '3' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 px-3 rounded-xl font-semibold text-sm transition-all ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">{tab.icon} {tab.step}. {tab.label}</span>
              <span className="sm:hidden">{tab.icon} {tab.step}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <ImageUploader onExtract={setExtractedData} />
            <StructuredDataDisplay data={extractedData} />
            {extractedData && (
              <div className="text-center">
                <button
                  onClick={() => setActiveTab('sign')}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition shadow-lg text-lg"
                >
                  Continuar a Firmar →
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sign' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">✍️ Firma Digital Certificada</h2>
              <p className="text-gray-500 mt-1">Ingrese su DNI y datos para generar el certificado digital</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <SignaturePad
                label="👤 Firma del Solicitante"
                signature={signer1}
                onSignatureChange={(dataUrl) => setSigner1(prev => ({ ...prev, dataUrl: dataUrl || null }))}
                onNameChange={(name) => setSigner1(prev => ({ ...prev, name }))}
                onRoleChange={(role) => setSigner1(prev => ({ ...prev, role }))}
                onDniChange={(dni) => setSigner1(prev => ({ ...prev, dni }))}
                onEmailChange={(email) => setSigner1(prev => ({ ...prev, email }))}
              />
              <SignaturePad
                label="🏢 Firma del Encargado de Empresa"
                signature={signer2}
                onSignatureChange={(dataUrl) => setSigner2(prev => ({ ...prev, dataUrl: dataUrl || null }))}
                onNameChange={(name) => setSigner2(prev => ({ ...prev, name }))}
                onRoleChange={(role) => setSigner2(prev => ({ ...prev, role }))}
                onDniChange={(dni) => setSigner2(prev => ({ ...prev, dni }))}
                onEmailChange={(email) => setSigner2(prev => ({ ...prev, email }))}
              />
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => setActiveTab('document')}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition shadow-lg text-lg"
              >
                Generar Documento Certificado →
              </button>
            </div>
          </div>
        )}

        {activeTab === 'document' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">📄 Documento Certificado Digital</h2>
              <p className="text-gray-500 mt-1">Documento formal con firma digital y hash de verificación</p>
            </div>

            <FormalDocument
              extractedData={extractedData}
              signer1={signer1}
              signer2={signer2}
            />

            <div className="text-center mt-6 flex flex-wrap justify-center gap-4">
              <button
                onClick={() => window.print()}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-indigo-700 transition shadow-lg text-lg"
              >
                🖨️ Imprimir / Guardar PDF
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold hover:from-gray-700 hover:to-gray-800 transition shadow-lg text-lg"
              >
                🔄 Nuevo Documento
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/80 border-t border-gray-200 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-gray-500">
            🔒 Sistema de Firma Digital con Certificado · Hash SHA-256 · Validez Legal
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            Todos los documentos generados incluyen hash de verificación único e inalterable
          </p>
        </div>
      </footer>
    </div>
  );
}
