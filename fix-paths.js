const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'dist', 'index.html');

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Reemplaza rutas que empiezan con / por ./
  // Busca href="/ y src="/ y les añade el punto
  content = content.replace(/href="\//g, 'href="./');
  content = content.replace(/src="\//g, 'src="./');
  
  // Caso especial: Evitar que rompa enlaces externos (http)
  content = content.replace(/href="\.\/http/g, 'href="http');
  content = content.replace(/src="\.\/http/g, 'src="http');

  fs.writeFileSync(filePath, content);
  console.log('✅ [KLANG FIX]: Puntos ./ añadidos correctamente a dist/index.html');
} else {
  console.error('❌ [KLANG FIX]: No se encontró dist/index.html');
}