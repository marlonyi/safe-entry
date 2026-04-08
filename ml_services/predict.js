const { exec } = require("child_process");
const path = require("path");

// 🔸 AJUSTA ESTAS RUTAS 🔸
const wekaPath = '"C:\\Program Files\\Weka-3-8-6\\weka.jar"'; // Ruta a tu instalación de Weka
const modelPath = path.join(__dirname, "modelo.model");
const testDataPath = path.join(__dirname, "datos_test.arff");

// 🔸 COMANDO PARA EJECUTAR WEKA
const command = `java -cp ${wekaPath} weka.classifiers.trees.J48 -l "${modelPath}" -T "${testDataPath}" -p 0`;

console.log("🔹 Ejecutando modelo de Weka...\n");

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error al ejecutar Weka: ${error.message}`);
    return;
  }
  if (stderr) {
    console.warn(`⚠️ Advertencia: ${stderr}`);
  }

  console.log("✅ Resultado del modelo:\n");
  console.log(stdout);
});
