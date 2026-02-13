const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 内存数据
let hotels = [
  {
    id: 1,
    name: '上海外滩华尔道夫酒店',
    nameEn: 'Waldorf Astoria Shanghai on the Bund',
    star: '5',
    openTime: '2011年',
    address: '上海 黄浦区 中山东一路2号',
    priceRange: '¥2000-¥5000',
    totalRooms: 260,
    roomTypes: ['豪华房', '行政房', '套房'],
    scenicSpots: ['外滩', '南京路', '豫园'],
    trafficMall: ['地铁2号线', '地铁10号线'],
    discounts: ['提前预订优惠', '连住优惠'],
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80',
    priceData: { roomPriceList: [
      { type: '豪华房', original: 2500, current: 2200 },
      { type: '行政房', original: 3200, current: 2800 },
      { type: '套房', original: 4800, current: 4200 }
    ]},
    createdBy: 'admin',
    createdAt: '2024-01-01 10:00:00'
  },
  {
    id: 2,
    name: '北京王府井希尔顿酒店',
    nameEn: 'Hilton Beijing Wangfujing',
    star: '5',
    openTime: '2008年',
    address: '北京 东城区 王府井东街8号',
    priceRange: '¥1800-¥4000',
    totalRooms: 255,
    roomTypes: ['高级房', '豪华房', '行政房'],
    scenicSpots: ['故宫', '天安门', '王府井'],
    trafficMall: ['地铁1号线', '地铁5号线'],
    discounts: ['会员优惠', '周末特惠'],
    image: 'https://images.unsplash.com/photo-1564501049418-3c27787d01e8?auto=format&fit=crop&w=1400&q=80',
    priceData: { roomPriceList: [
      { type: '高级房', original: 2000, current: 1800 },
      { type: '豪华房', original: 2500, current: 2200 },
      { type: '行政房', original: 3200, current: 2900 }
    ]},
    createdBy: 'admin',
    createdAt: '2024-01-02 11:00:00'
  }
];

let rooms = [
  { id: 1, hotel_id: 1, type: '豪华房', original: 2500, current: 2200, discount: '12%', remain: 5, status: 'available', remark: '含早餐', image: '' },
  { id: 2, hotel_id: 1, type: '行政房', original: 3200, current: 2800, discount: '12.5%', remain: 3, status: 'available', remark: '行政酒廊', image: '' },
  { id: 3, hotel_id: 1, type: '套房', original: 4800, current: 4200, discount: '12.5%', remain: 2, status: 'available', remark: '江景', image: '' },
  { id: 4, hotel_id: 2, type: '高级房', original: 2000, current: 1800, discount: '10%', remain: 8, status: 'available', remark: '城市景观', image: '' },
  { id: 5, hotel_id: 2, type: '豪华房', original: 2500, current: 2200, discount: '12%', remain: 6, status: 'available', remark: '含早餐', image: '' }
];

let submissions = [];
let orders = [];

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 辅助函数
function formatDateForMySQL(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function deriveRating(star) {
  const raw = String(star || '').replace(/[^\d.]/g, '');
  const num = Number(raw);
  if (Number.isFinite(num) && num > 0) {
    return Math.min(5, Math.max(1, num));
  }
  return 4.5;
}

function inferBedType(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('king') || t.includes('大床')) return 'King';
  if (t.includes('twin') || t.includes('双床')) return 'Twin';
  if (t.includes('queen')) return 'Queen';
  return 'Queen';
}

function buildMobileImages(coverImage) {
  const fallback = 'https://images.unsplash.com/photo-1501117716987-c8e1ecb2105f?auto=format&fit=crop&w=1400&q=80';
  const base = coverImage || fallback;
  return [base];
}

function buildMobileTags(roomTypes, discounts) {
  const list = [...(roomTypes || []), ...(discounts || [])];
  const unique = [...new Set(list.filter(Boolean))];
  return unique.length ? unique.slice(0, 5) : ['Popular', 'Business'];
}

function buildMobileFacilities(scenicSpots, trafficMall) {
  const list = [...(scenicSpots || []), ...(trafficMall || [])];
  const unique = [...new Set(list.filter(Boolean))];
  return unique.length ? unique.slice(0, 6) : ['Wifi', 'Parking', 'Restaurant'];
}

// -------------------- Hotels API --------------------
app.get('/api/hotels', (req, res) => {
  res.json({ code: 200, data: hotels });
});

app.get('/api/hotels/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const hotel = hotels.find(h => h.id === id);
  if (!hotel) return res.status(404).json({ code: 404, msg: 'not found' });
  res.json({ code: 200, data: hotel });
});

app.post('/api/hotels', (req, res) => {
  const payload = req.body || {};
  const newId = hotels.length > 0 ? Math.max(...hotels.map(h => h.id)) + 1 : 1;
  const newHotel = {
    id: newId,
    name: payload.name || '',
    nameEn: payload.nameEn || '',
    star: payload.star || '',
    openTime: payload.openTime || '',
    address: payload.address || '',
    priceRange: payload.priceRange || '',
    totalRooms: payload.totalRooms || 0,
    roomTypes: Array.isArray(payload.roomTypes) ? payload.roomTypes : [],
    scenicSpots: Array.isArray(payload.scenicSpots) ? payload.scenicSpots : [],
    trafficMall: Array.isArray(payload.trafficMall) ? payload.trafficMall : [],
    discounts: Array.isArray(payload.discounts) ? payload.discounts : [],
    image: payload.image || '',
    priceData: payload.priceData || { roomPriceList: [] },
    createdBy: payload.createdBy || 'user',
    createdAt: formatDateForMySQL()
  };
  hotels.push(newHotel);
  res.json({ code: 200, data: newHotel });
});

app.put('/api/hotels/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const p = req.body || {};
  const index = hotels.findIndex(h => h.id === id);
  if (index === -1) return res.status(404).json({ code: 404, msg: 'hotel not found' });
  
  hotels[index] = {
    ...hotels[index],
    name: p.name || hotels[index].name,
    nameEn: p.nameEn || hotels[index].nameEn,
    star: p.star || hotels[index].star,
    openTime: p.openTime || hotels[index].openTime,
    address: p.address || hotels[index].address,
    priceRange: p.priceRange || hotels[index].priceRange,
    totalRooms: p.totalRooms || hotels[index].totalRooms,
    roomTypes: Array.isArray(p.roomTypes) ? p.roomTypes : hotels[index].roomTypes,
    scenicSpots: Array.isArray(p.scenicSpots) ? p.scenicSpots : hotels[index].scenicSpots,
    trafficMall: Array.isArray(p.trafficMall) ? p.trafficMall : hotels[index].trafficMall,
    discounts: Array.isArray(p.discounts) ? p.discounts : hotels[index].discounts,
    image: p.image || hotels[index].image,
    priceData: p.priceData || hotels[index].priceData
  };
  
  res.json({ code: 200, data: hotels[index] });
});

app.delete('/api/hotels/:id', (req, res) => {
  const id = parseInt(req.params.id);
  hotels = hotels.filter(h => h.id !== id);
  rooms = rooms.filter(r => r.hotel_id !== id);
  res.json({ code: 200, msg: 'deleted' });
});

// -------------------- Rooms API --------------------
app.get('/api/hotels/:id/rooms', (req, res) => {
  const id = parseInt(req.params.id);
  const hotelRooms = rooms.filter(r => r.hotel_id === id);
  res.json({ code: 200, data: hotelRooms });
});

app.post('/api/hotels/:id/rooms', (req, res) => {
  const id = parseInt(req.params.id);
  const p = req.body || {};
  const newId = rooms.length > 0 ? Math.max(...rooms.map(r => r.id)) + 1 : 1;
  const newRoom = {
    id: newId,
    hotel_id: id,
    type: p.type || '',
    original: p.original || 0,
    current: p.current || 0,
    discount: p.discount || '',
    remain: p.remain || 0,
    status: p.status || 'available',
    remark: p.remark || '',
    image: p.image || ''
  };
  rooms.push(newRoom);
  res.json({ code: 200, data: newRoom });
});

// -------------------- Mobile API --------------------
app.get('/api/mobile/hotels', (req, res) => {
  const data = hotels.map(h => {
    const hotelRooms = rooms.filter(r => r.hotel_id === h.id);
    const minPrice = hotelRooms.length > 0 
      ? Math.min(...hotelRooms.map(r => r.current > 0 ? r.current : r.original).filter(p => p > 0))
      : 0;
    
    return {
      id: String(h.id),
      name: h.name || '',
      city: h.address ? String(h.address).split(' ')[0] : '未知',
      rating: deriveRating(h.star),
      address: h.address || '',
      coverImage: h.image || buildMobileImages('')[0],
      images: buildMobileImages(h.image),
      tags: buildMobileTags(h.roomTypes, h.discounts),
      facilities: buildMobileFacilities(h.scenicSpots, h.trafficMall),
      priceFrom: minPrice || 0,
      rooms: []
    };
  });
  
  res.json({ code: 200, data });
});

app.get('/api/mobile/hotels/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const hotel = hotels.find(h => h.id === id);
  if (!hotel) return res.status(404).json({ code: 404, msg: 'not found' });
  
  const hotelRooms = rooms.filter(r => r.hotel_id === id);
  const roomList = hotelRooms.map(r => ({
    id: String(r.id),
    name: r.type || 'Standard',
    price: Number(r.current || r.original || 0),
    capacity: 2,
    bedType: inferBedType(r.type),
    breakfastIncluded: false,
    refundable: false
  }));
  
  const minPrice = hotelRooms.length > 0 
    ? Math.min(...hotelRooms.map(r => r.current > 0 ? r.current : r.original).filter(p => p > 0))
    : 0;
  
  const data = {
    id: String(hotel.id),
    name: hotel.name || '',
    city: hotel.address ? String(hotel.address).split(' ')[0] : '未知',
    rating: deriveRating(hotel.star),
    address: hotel.address || '',
    coverImage: hotel.image || buildMobileImages('')[0],
    images: buildMobileImages(hotel.image),
    tags: buildMobileTags(hotel.roomTypes, hotel.discounts),
    facilities: buildMobileFacilities(hotel.scenicSpots, hotel.trafficMall),
    priceFrom: minPrice || 0,
    rooms: roomList
  };
  
  res.json({ code: 200, data });
});

app.post('/api/mobile/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'mobile' && password === '123456') {
    const token = `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return res.json({ code: 200, data: { token, user: { username: 'mobile', name: '移动端用户' } } });
  }
  return res.status(401).json({ code: 401, msg: 'invalid credentials' });
});

// -------------------- 其他API --------------------
app.get('/api/submissions', (req, res) => {
  res.json({ code: 200, data: submissions });
});

app.post('/api/submissions', (req, res) => {
  const p = req.body || {};
  const newId = submissions.length > 0 ? Math.max(...submissions.map(s => s.id)) + 1 : 1;
  const newSubmission = {
    id: newId,
    ...p,
    status: 'pending',
    createdAt: formatDateForMySQL()
  };
  submissions.push(newSubmission);
  res.json({ code: 200, data: newSubmission });
});

app.get('/api/orders/:hotelId', (req, res) => {
  const hotelId = parseInt(req.params.hotelId);
  const hotelOrders = orders.filter(o => o.hotel_id === hotelId);
  res.json({ code: 200, data: hotelOrders });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`简易API服务器运行在 http://localhost:${PORT}`);
  console.log('可用端点:');
  console.log(`  GET  /api/hotels - 获取所有酒店`);
  console.log(`  GET  /api/mobile/hotels - 移动端酒店列表`);
  console.log(`  POST /api/mobile/login - 移动端登录`);
  console.log(`  GET  /api/hotels/:id - 获取特定酒店`);
  console.log(`  GET  /api/hotels/:id/rooms - 获取酒店房型`);
});