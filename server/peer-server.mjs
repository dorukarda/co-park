// İsteğe bağlı: kendi eşleştirme (signaling) sunucunuz.
// Çalıştırma: npm run server   → oyunu ?server=SUNUCU_ADRESI:9000 ile açın.
// Oyun verisi bu sunucudan geçmez; yalnızca oyuncuların birbirini bulmasını sağlar.
import express from 'express';
import { ExpressPeerServer } from 'peer';

const port = Number(process.env.PORT || 9000);
const app = express();
const server = app.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`CO-PARK eşleştirme sunucusu: http://localhost:${port}`));
app.use('/', ExpressPeerServer(server, { path: '/', allow_discovery: false }));
app.get('/health', (_, res) => res.send('ok'));
