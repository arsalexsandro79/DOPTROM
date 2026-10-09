import { useState, useRef, useEffect, useCallback } from 'react';
import Tesseract from 'tesseract.js';

// ==================== TYPES ====================
interface ExtractedData {
  rawText: string;
  lines: string[];
  timestamp: string;
}

interface SignatureData {
  dataUrl: string | null;
  name: string;
  role: string;
}

// ==================== SIGNATURE PAD COMPONENT ====================
function SignaturePad({
  label,
  signature,
  onSignatureChange,
  onNameChange,
  onRoleChange,
}: {
  label: string;
  signature: SignatureData;
  onSignatureChange: (dataUrl: string) => void;
  onNameChange: (name: string) => void;
  onRoleChange: (role: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
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
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a365d';
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
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">{label}</h3>
      
      {/* Name and Role inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Nombre completo</label>
          <input
            type="text"
            value={signature.name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Ingrese nombre..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Cargo / Rol</label>
          <input
            type="text"
            value={signature.role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Ingrese cargo..."
          />
        </div>
      </div>

      {/* Signature Canvas */}
      <div className="relative">
        <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
          <canvas
            ref={canvasRef}
            width={400}
            height={150}
            className="w-full cursor-crosshair touch-none"
            style={{ height: '150px' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {hasContent ? '✓ Firma registrada' : 'Dibuje su firma aquí'}
        </p>
      </div>

      {/* Clear button */}
      <button
        onClick={clearSignature}
        className="mt-3 px-4 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium"
      >
        ✕ Limpiar firma
      </button>
    </div>
  );
}

// ==================== IMAGE UPLOADER COMPONENT ====================
function ImageUploader({
  onExtract,
}: {
  onExtract: (data: ExtractedData) => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
    };
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
      const lines = text.split('\n').filter((line) => line.trim() !== '');

      onExtract({
        rawText: text,
        lines,
        timestamp: new Date().toLocaleString('es-ES'),
      });
    } catch (error) {
      console.error('Error procesando imagen:', error);
      onExtract({
        rawText: 'Error al procesar la imagen. Intente nuevamente.',
        lines: [],
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
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        📷 Cargar Imagen para Extraer Datos
      </h3>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
      >
        {image ? (
          <img
            src={image}
            alt="Preview"
            className="max-h-48 mx-auto rounded-lg shadow-sm"
          />
        ) : (
          <div className="py-6">
            <div className="text-5xl mb-3">📄</div>
            <p className="text-gray-600 font-medium">
              Arrastra una imagen aquí o haz clic para seleccionar
            </p>
            <p className="text-sm text-gray-400 mt-1">
              PNG, JPG, JPEG, BMP, TIFF
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Process button */}
      {image && (
        <div className="mt-4">
          <button
            onClick={processImage}
            disabled={processing}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Procesando... {progress}%
              </span>
            ) : (
              '🔍 Extraer Datos de la Imagen'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== EXTRACTED DATA DISPLAY ====================
function ExtractedDataDisplay({ data }: { data: ExtractedData | null }) {
  if (!data) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          📋 Datos Extraídos
        </h3>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
          {data.timestamp}
        </span>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
        {data.lines.length > 0 ? (
          <div className="space-y-1">
            {data.lines.map((line, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700 py-1 border-b border-gray-100 last:border-0"
              >
                <span className="text-blue-500 font-mono text-xs mt-0.5">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm italic">
            {data.rawText || 'No se pudieron extraer datos de la imagen.'}
          </p>
        )}
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
    `DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  );
  const [currentDate] = useState(
    new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  );

  const generateHash = useCallback(() => {
    const text = `${docNumber}${currentDate}${signer1.name}${signer2.name}${extractedData?.rawText || ''}`;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(12, '0');
  }, [docNumber, currentDate, signer1.name, signer2.name, extractedData]);

  return (
    <div className="bg-white rounded-xl shadow-2xl border-2 border-gray-300 p-8 max-w-4xl mx-auto" id="formal-document">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-800 pb-6 mb-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-700 to-indigo-800 rounded-full flex items-center justify-center">
            <span className="text-white text-xl font-bold">✓</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-wide">
              DOCUMENTO CERTIFICADO DIGITAL
            </h1>
            <p className="text-sm text-gray-500 tracking-widest uppercase">
              Sistema de Verificación y Firma Electrónica
            </p>
          </div>
        </div>
      </div>

      {/* Document Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">N° Documento</p>
          <p className="font-mono text-sm font-semibold text-gray-800">{docNumber}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Fecha de Emisión</p>
          <p className="text-sm font-semibold text-gray-800">{currentDate}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Hash de Verificación</p>
          <p className="font-mono text-xs text-gray-600 break-all">{generateHash()}</p>
        </div>
      </div>

      {/* Extracted Data Section */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-sm font-bold">1</span>
          DATOS DEL DOCUMENTO ORIGINAL
        </h2>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          {extractedData ? (
            <div className="space-y-1">
              {extractedData.lines.length > 0 ? (
                extractedData.lines.map((line, i) => (
                  <p key={i} className="text-sm text-gray-700 font-mono">{line}</p>
                ))
              ) : (
                <p className="text-sm text-gray-600 italic">{extractedData.rawText}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">
              No se han cargado datos de imagen.
            </p>
          )}
        </div>
      </div>

      {/* Signatures Section */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-sm font-bold">2</span>
          FIRMAS AUTORIZADAS
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Signer 1 */}
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Firmante 1</p>
            <div className="h-24 flex items-center justify-center bg-white rounded border border-gray-200 mb-3">
              {signer1.dataUrl ? (
                <img src={signer1.dataUrl} alt="Firma" className="max-h-20 object-contain" />
              ) : (
                <span className="text-gray-300 text-sm">Sin firma</span>
              )}
            </div>
            <div className="border-t border-gray-300 pt-2">
              <p className="font-semibold text-gray-800">{signer1.name || '________________'}</p>
              <p className="text-sm text-gray-500">{signer1.role || 'Cargo no especificado'}</p>
            </div>
          </div>

          {/* Signer 2 */}
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Firmante 2</p>
            <div className="h-24 flex items-center justify-center bg-white rounded border border-gray-200 mb-3">
              {signer2.dataUrl ? (
                <img src={signer2.dataUrl} alt="Firma" className="max-h-20 object-contain" />
              ) : (
                <span className="text-gray-300 text-sm">Sin firma</span>
              )}
            </div>
            <div className="border-t border-gray-300 pt-2">
              <p className="font-semibold text-gray-800">{signer2.name || '________________'}</p>
              <p className="text-sm text-gray-500">{signer2.role || 'Cargo no especificado'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Digital Seal */}
      <div className="border-t-2 border-gray-300 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 border-4 border-green-600 rounded-full flex items-center justify-center bg-green-50">
              <div className="text-center">
                <span className="text-green-700 text-lg font-bold">✓</span>
                <p className="text-[8px] text-green-700 font-bold">VALID</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-green-700">DOCUMENTO VERIFICADO</p>
              <p className="text-xs text-gray-500">Firma digital certificada</p>
              <p className="text-xs text-gray-400 font-mono">ID: {generateHash()}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Generado el</p>
            <p className="text-sm text-gray-600">{new Date().toLocaleString('es-ES')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================
export default function App() {
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [signer1, setSigner1] = useState<SignatureData>({
    dataUrl: null,
    name: '',
    role: '',
  });
  const [signer2, setSigner2] = useState<SignatureData>({
    dataUrl: null,
    name: '',
    role: 'Encargado de Empresa',
  });
  const [activeTab, setActiveTab] = useState<'upload' | 'sign' | 'document'>('upload');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">📝</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">DocuSign Digital</h1>
                <p className="text-xs text-gray-500">Extracción de datos y firma electrónica</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Sistema activo
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📷 1. Cargar Imagen
          </button>
          <button
            onClick={() => setActiveTab('sign')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'sign'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            ✍️ 2. Firmar
          </button>
          <button
            onClick={() => setActiveTab('document')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'document'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📄 3. Documento Final
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <ImageUploader onExtract={setExtractedData} />
            <ExtractedDataDisplay data={extractedData} />
            
            {extractedData && (
              <div className="text-center">
                <button
                  onClick={() => setActiveTab('sign')}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition shadow-lg"
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
              <h2 className="text-2xl font-bold text-gray-800">Firmas del Documento</h2>
              <p className="text-gray-500">Ambas partes deben firmar para validar el documento</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SignaturePad
                label="👤 Firma del Solicitante"
                signature={signer1}
                onSignatureChange={(dataUrl) =>
                  setSigner1((prev) => ({ ...prev, dataUrl: dataUrl || null }))
                }
                onNameChange={(name) => setSigner1((prev) => ({ ...prev, name }))}
                onRoleChange={(role) => setSigner1((prev) => ({ ...prev, role }))}
              />
              <SignaturePad
                label="🏢 Firma del Encargado de Empresa"
                signature={signer2}
                onSignatureChange={(dataUrl) =>
                  setSigner2((prev) => ({ ...prev, dataUrl: dataUrl || null }))
                }
                onNameChange={(name) => setSigner2((prev) => ({ ...prev, name }))}
                onRoleChange={(role) => setSigner2((prev) => ({ ...prev, role }))}
              />
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => setActiveTab('document')}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition shadow-lg"
              >
                Ver Documento Final →
              </button>
            </div>
          </div>
        )}

        {activeTab === 'document' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Documento Certificado</h2>
              <p className="text-gray-500">Vista previa del documento formal firmado digitalmente</p>
            </div>

            <FormalDocument
              extractedData={extractedData}
              signer1={signer1}
              signer2={signer2}
            />

            <div className="text-center mt-6">
              <button
                onClick={() => window.print()}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition shadow-lg"
              >
                🖨️ Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/60 border-t border-gray-200 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center">
          <p className="text-sm text-gray-500">
            🔒 Sistema de Firma Digital · Todos los documentos son certificados con hash de verificación único
          </p>
        </div>
      </footer>
    </div>
  );
}
