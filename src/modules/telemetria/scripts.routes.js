const express = require("express");
const router = express.Router();
const { exec } = require("child_process");
const path = require("path");
const fs = require('fs');
// ========================================
// 📌 Imports desde nueva estructura modular
// ========================================
const { middlewares } = require('../../index');
const { verificarToken, esPorteriaOAdmin } = middlewares.auth;

// Ruta base del proyecto (3 niveles arriba desde este archivo)
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");

// Iniciar script de LPR (Reconocimiento de Placas)
router.post("/lpr", verificarToken, esPorteriaOAdmin, (req, res) => {
  try {
    const lprDir = path.join(PROJECT_ROOT, "Reconocimiento");
    const scriptPath = path.join(lprDir, "Placascolombianas.py");
    console.log(`Ejecutando script LPR en: ${lprDir}`);

    // Verificar que el archivo existe
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({
        success: false,
        message: `Script LPR no encontrado: ${scriptPath}`,
      });
    }

    // Usar exec con shell de Windows para abrir una ventana nueva
    const command = `start "LPR (Placas)" cmd /k python "${scriptPath}"`;

    exec(command, { cwd: lprDir, windowsHide: false }, (error) => {
      if (error) {
        console.error("Error al iniciar script LPR:", error);
      }
    });

    res.status(200).json({
      success: true,
      data: null,
      message: "Cámara LPR encendida! Revisa la ventana en tu escritorio.",
    });
  } catch (error) {
    console.error("Error al iniciar script LPR:", error);
    res.status(500).json({
      success: false,
      message: "Error al iniciar script LPR",
      error: error.message,
    });
  }
});

// Iniciar script de lector QR
router.post("/qr", verificarToken, esPorteriaOAdmin, (req, res) => {
  try {
    const qrDir = path.join(PROJECT_ROOT, "qr-scanner");
    const scriptPath = path.join(qrDir, "test_qr_opencv.py");
    console.log(`Ejecutando script QR en: ${qrDir}`);

    // Verificar que el archivo existe
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({
        success: false,
        message: `Script QR no encontrado: ${scriptPath}`,
      });
    }

    // Usar exec con shell de Windows para abrir una ventana nueva
    const command = `start "Escaner QR" cmd /k python "${scriptPath}"`;

    exec(command, { cwd: qrDir, windowsHide: false }, (error) => {
      if (error) {
        console.error("Error al iniciar script QR:", error);
      }
    });

    res.status(200).json({
      success: true,
      data: null,
      message: "Cámara QR encendida! Revisa la ventana en tu escritorio.",
    });
  } catch (error) {
    console.error("Error al iniciar script QR:", error);
    res.status(500).json({
      success: false,
      message: "Error al iniciar script QR",
      error: error.message,
    });
  }
});

module.exports = router;