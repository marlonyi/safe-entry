"""
Script para convertir el documento de especificaciones a Word
"""
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
import re

def add_heading(doc, text, level):
    """Agregar encabezado con estilo"""
    heading = doc.add_heading(text, level=level)
    return heading

def add_table(doc, headers, rows):
    """Agregar tabla con formato"""
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = 'Table Grid'
    
    # Encabezados
    hdr_cells = table.rows[0].cells
    for i, header in enumerate(headers):
        hdr_cells[i].text = header
        for paragraph in hdr_cells[i].paragraphs:
            for run in paragraph.runs:
                run.bold = True
    
    # Filas
    for row_data in rows:
        row_cells = table.add_row().cells
        for i, cell_data in enumerate(row_data):
            row_cells[i].text = str(cell_data)
    
    return table

# Crear documento
doc = Document()

# Título principal
title = doc.add_heading('Sistema de Reconocimiento de Placas Colombianas', 0)
subtitle = doc.add_paragraph('Especificaciones Tecnicas y Propuesta Comercial')
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER

doc.add_paragraph()

# Descripción
doc.add_heading('Descripcion del Sistema', level=1)
desc = doc.add_paragraph(
    'Sistema inteligente de reconocimiento automatico de placas vehiculares (LPR/ANPR) '
    'disenado especificamente para el mercado colombiano.'
)

# Lista de características
features = [
    'Deteccion en tiempo real mediante procesamiento de imagenes',
    'Reconocimiento OCR con inteligencia artificial (EasyOCR + PyTorch)',
    'Soporte para formatos colombianos: ABC123 (antiguo) y ABC12D (nuevo)',
    'Sistema de votacion para mayor precision',
    'Integracion con base de datos MongoDB',
    'Compatible con vision infrarroja/nocturna',
    'Conexion a camaras IP, DVR y camaras USB'
]

for feature in features:
    doc.add_paragraph(feature, style='List Bullet')

# Requisitos Mínimos
doc.add_heading('Requisitos Tecnicos', level=1)
doc.add_heading('Configuracion Minima (Funcionamiento Basico)', level=2)

add_table(doc, 
    ['Componente', 'Especificacion'],
    [
        ['Procesador', 'Intel Core i5 (4ta gen) / AMD Ryzen 5'],
        ['Memoria RAM', '8 GB DDR4'],
        ['GPU', 'No requerida (opcional)'],
        ['Almacenamiento', '10 GB SSD disponibles'],
        ['Camara', 'USB 2.0 / Webcam / IP 720p'],
        ['Red', 'Ethernet o WiFi estable'],
        ['Sistema Operativo', 'Windows 10/11 o Linux Ubuntu 20.04+']
    ]
)

doc.add_paragraph()
warn = doc.add_paragraph('NOTA: Sin GPU dedicada, el procesamiento sera de ~2-3 FPS. Puede perder algunas placas en trafico rapido.')
warn.runs[0].italic = True

# Requisitos Recomendados
doc.add_heading('Configuracion Recomendada (Produccion)', level=2)

add_table(doc,
    ['Componente', 'Especificacion'],
    [
        ['Procesador', 'Intel Core i7/i9 (10ma gen+) / AMD Ryzen 7/9'],
        ['Memoria RAM', '16 GB DDR4 o superior'],
        ['GPU', 'NVIDIA RTX 2060+ con CUDA (6GB VRAM min)'],
        ['Almacenamiento', '20 GB SSD NVMe'],
        ['Camara', 'IP 1080p / Industrial con IR'],
        ['Red', 'Ethernet Gigabit'],
        ['Sistema Operativo', 'Windows 10/11 Pro o Linux Ubuntu 22.04']
    ]
)

doc.add_paragraph()
tip = doc.add_paragraph('RECOMENDACION: Con GPU NVIDIA, el procesamiento alcanza 15-30 FPS en tiempo real.')
tip.runs[0].bold = True

# Compatibilidad de Cámaras
doc.add_heading('Compatibilidad de Camaras', level=1)
doc.add_heading('Tipos Soportados', level=2)

add_table(doc,
    ['Tipo de Camara', 'Compatibilidad', 'Conexion'],
    [
        ['Webcam USB', 'Completa', 'Directa'],
        ['Camara IP', 'Completa', 'RTSP/HTTP'],
        ['DVR/NVR', 'Completa', 'RTSP por canal'],
        ['Camara IR/Nocturna', 'Completa', 'Cualquier metodo'],
        ['ONVIF', 'Completa', 'Protocolo estandar']
    ]
)

doc.add_paragraph()

# URLs RTSP
doc.add_heading('URLs RTSP por Marca de DVR', level=2)

add_table(doc,
    ['Marca', 'Formato URL'],
    [
        ['Hikvision', 'rtsp://user:pass@IP:554/Streaming/Channels/101'],
        ['Dahua', 'rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=0'],
        ['Provision', 'rtsp://user:pass@IP:554/ch01/0'],
        ['Samsung', 'rtsp://user:pass@IP:554/profile1/media.smp'],
        ['Generico ONVIF', 'rtsp://user:pass@IP:554/onvif1']
    ]
)

doc.add_paragraph()

# Visión Nocturna
doc.add_heading('Vision Nocturna / Infrarroja', level=1)
doc.add_paragraph('El sistema esta optimizado para operar con iluminacion IR:')

ir_features = [
    'Procesamiento en escala de grises (compatible con imagen IR monocromatica)',
    'Algoritmo CLAHE para mejora de contraste en baja luz',
    '5 metodos de preprocesamiento para maximizar deteccion'
]
for f in ir_features:
    doc.add_paragraph(f, style='List Bullet')

doc.add_heading('Recomendaciones para Instalacion Nocturna', level=2)
add_table(doc,
    ['Elemento', 'Recomendacion'],
    [
        ['Iluminador IR', '850nm (invisible) o 940nm'],
        ['Modo camara', 'Dia/Noche automatico'],
        ['Posicion', 'Frontal a vehiculos, 1-2m altura'],
        ['Angulo', 'Perpendicular al flujo vehicular'],
        ['Placas reflectivas', 'Mejor rendimiento con IR']
    ]
)

doc.add_paragraph()

# Comparativa de Costos
doc.add_heading('Comparativa de Costos', level=1)
doc.add_heading('Solucion A: Camaras LPR Dedicadas (Competencia)', level=2)

add_table(doc,
    ['Marca/Modelo', 'Precio USD', 'Observaciones'],
    [
        ['Hikvision DS-2CD7A26G0/P', '$800 - $1,200', 'LPR integrado'],
        ['Dahua ITC237-PW6M', '$700 - $1,000', 'Con barrera'],
        ['Axis P1445-LE-3', '$1,500 - $2,000', 'Premium'],
        ['Genetec AutoVu', '$2,000 - $4,000', 'Sistema completo'],
        ['Avigilon LPR', '$1,800 - $3,000', 'Alta precision']
    ]
)

doc.add_paragraph()
doc.add_paragraph('Costos adicionales tipicos:', style='List Bullet')
doc.add_paragraph('Licencia anual: $200 - $500/ano por camara', style='List Bullet')
doc.add_paragraph('Integracion: $500 - $2,000', style='List Bullet')
doc.add_paragraph('Soporte: Variable', style='List Bullet')

# Nuestra solución
doc.add_heading('Solucion B: Nuestro Sistema (Propuesta)', level=2)

add_table(doc,
    ['Componente', 'Precio USD'],
    [
        ['Camara IP 1080p basica', '$50 - $150'],
        ['Iluminador IR (opcional)', '$30 - $80'],
        ['Mini PC / Computador', '$200 - $400'],
        ['Software (licencia)', 'A definir'],
        ['Base de datos MongoDB', '$0 (Open Source)']
    ]
)

doc.add_paragraph()
total = doc.add_paragraph('Total inversion inicial: $300 - $600 USD')
total.runs[0].bold = True

# Tabla comparativa
doc.add_heading('Tabla Comparativa', level=2)

add_table(doc,
    ['Aspecto', 'Camara LPR Dedicada', 'Nuestra Solucion'],
    [
        ['Costo inicial', '$800 - $2,000', '$300 - $600'],
        ['Licencia anual', '$200 - $500', 'Flexible'],
        ['Precision estimada', '95-99%', '85-95%'],
        ['Costo entrada adicional', '+$800+', '+$50 (camara)'],
        ['Personalizacion', 'Limitada', 'Total'],
        ['Integracion APIs', 'SDK cerrado', 'API abierta'],
        ['Dependencia fabricante', 'Alta', 'Ninguna'],
        ['Usa camaras existentes', 'No', 'Si'],
        ['Soporte local', 'Internacional', 'Local']
    ]
)

doc.add_paragraph()
ahorro = doc.add_paragraph('AHORRO ESTIMADO: 60-80% comparado con soluciones de camaras LPR dedicadas.')
ahorro.runs[0].bold = True

# Modelo de Comercialización
doc.add_heading('Modelo de Comercializacion Sugerido', level=1)
doc.add_heading('Opciones de Licenciamiento', level=2)

add_table(doc,
    ['Concepto', 'Precio Sugerido USD'],
    [
        ['Instalacion y configuracion', '$200 - $400'],
        ['Licencia perpetua (basica)', '$300 - $500'],
        ['Licencia con actualizaciones/ano', '$150 - $250/ano'],
        ['Soporte tecnico mensual', '$50 - $100/mes'],
        ['Camara + instalacion (opcional)', '$150 - $300']
    ]
)

doc.add_paragraph()

# Paquetes
doc.add_heading('Paquetes Comerciales', level=2)

doc.add_heading('Paquete Basico - $500 USD', level=3)
for item in ['1 punto de reconocimiento', 'Instalacion en PC cliente', 'Configuracion inicial', '30 dias de soporte']:
    doc.add_paragraph(item, style='List Bullet')

doc.add_heading('Paquete Profesional - $800 USD', level=3)
for item in ['1 punto de reconocimiento', 'Mini PC incluido', 'Camara IP 1080p', '90 dias de soporte', '1 ano de actualizaciones']:
    doc.add_paragraph(item, style='List Bullet')

doc.add_heading('Paquete Enterprise - $1,500 USD', level=3)
for item in ['2 puntos (entrada + salida)', 'Mini PC dedicado', '2 camaras IP + IR', 'Integracion con DVR existente', '1 ano soporte + actualizaciones', 'Capacitacion incluida']:
    doc.add_paragraph(item, style='List Bullet')

# Ventajas
doc.add_heading('Ventajas Competitivas', level=1)

ventajas = [
    'Costo significativamente menor que soluciones comerciales',
    'Disenado para placas colombianas (formatos especificos)',
    'Compatible con infraestructura existente (DVR, camaras IP)',
    'Sin dependencia de fabricantes internacionales',
    'API abierta para integracion con otros sistemas',
    'Soporte tecnico local y personalizado',
    'Personalizable segun necesidades del cliente'
]
for v in ventajas:
    doc.add_paragraph(v, style='List Number')

# Consideraciones
doc.add_heading('Consideraciones Importantes', level=1)
doc.add_paragraph('Para transparencia con el cliente:')

consideraciones = [
    'Requiere PC/Mini PC corriendo 24/7',
    'Primera ejecucion descarga modelos (~1.5GB)',
    'Condiciones de iluminacion afectan precision',
    'Mantenimiento periodico de software recomendado'
]
for c in consideraciones:
    doc.add_paragraph(c, style='List Number')

# Contacto
doc.add_heading('Informacion de Contacto', level=1)
doc.add_paragraph('[Completar con datos de la empresa]')
doc.add_paragraph()
contact_items = ['Empresa:', 'Contacto:', 'Telefono:', 'Email:', 'Direccion:']
for item in contact_items:
    p = doc.add_paragraph()
    p.add_run(item).bold = True
    p.add_run(' _______________________________')

doc.add_paragraph()
doc.add_paragraph('Documento generado: Enero 2026')
doc.add_paragraph('Version: 1.0')

# Guardar
output_path = r'C:\Users\Usuario\Music\admin-residencial\admin-residencial (1)\admin-residencial\Especificaciones_LPR_Comercial.docx'
doc.save(output_path)
print(f'Documento Word guardado en: {output_path}')
