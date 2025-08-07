# InfraSync - Premium Helpdesk Application

InfraSync je moderna helpdesk aplikacija sa premium funkcionalnostima sličnim Toggl aplikaciji. Aplikacija pruža napredne funkcionalnosti za upravljanje tiketa, analitiku, time tracking i real-time komunikaciju.

## 🚀 Funkcionalnosti

### Osnovne Funkcionalnosti
- ✅ Autentifikacija i autorizacija korisnika
- ✅ Upravljanje tiketa (kreiranje, uređivanje, praćenje)
- ✅ Različiti nivoi pristupa (Admin, Manager, Agent, User)
- ✅ Real-time notifikacije
- ✅ Responsive dizajn

### Premium Funkcionalnosti
- 🔥 **Time Tracking** - Praćenje vremena rada na tiketa
- 📊 **Napredna Analitika** - Izveštaji i statistike
- 👥 **Upravljanje Korisnicima** - Dodavanje, uređivanje, deaktivacija
- 🏢 **Upravljanje Kompanijama** - Multi-tenant sistem sa kompanijama
- 📈 **Performance Metrics** - Metrike performansi agenata
- 🎯 **SLA Monitoring** - Praćenje Service Level Agreements
- 📋 **Custom Fields** - Prilagođena polja za tikete
- 🔄 **Automation** - Automatski workflow-ovi
- 🔌 **Integrations** - Integracija sa drugim sistemima

## 🛠️ Tehnologije

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Baza podataka
- **Mongoose** - ODM za MongoDB
- **Socket.IO** - Real-time komunikacija
- **JWT** - Autentifikacija
- **bcryptjs** - Hashiranje lozinki

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Material-UI** - UI komponente
- **React Router** - Rutiranje
- **React Query** - State management
- **Socket.IO Client** - Real-time komunikacija
- **React Hook Form** - Form handling

## 📦 Instalacija

### Preduslovi
- Node.js (v16 ili noviji)
- MongoDB (lokalno ili MongoDB Atlas)
- npm ili yarn

### Koraci za instalaciju

1. **Klonirajte repozitorijum**
```bash
git clone <repository-url>
cd InfraSync
```

2. **Instalirajte sve dependencies**
```bash
npm run install-all
```

3. **Konfigurišite environment varijable**
```bash
# Kreirajte .env fajl u server direktorijumu
cd server
cp .env.example .env
```

Uredite `.env` fajl:
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/infrasync
JWT_SECRET=your-super-secret-jwt-key
CLIENT_URL=http://localhost:3000
```

4. **Pokrenite MongoDB**
```bash
# Ako koristite lokalni MongoDB
mongod
```

5. **Pokrenite aplikaciju**
```bash
# Iz root direktorijuma
npm run dev
```

Aplikacija će biti dostupna na:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 👤 Korisnički Nivoi

### Free Plan
- Osnovno kreiranje tiketa
- Pregled sopstvenih tiketa
- Osnovne notifikacije

### Basic Plan
- Sve iz Free plana
- Uređivanje tiketa
- Naprednije filtriranje

### Premium Plan
- Sve iz Basic plana
- Time tracking
- Napredna analitika
- Custom fields
- Performance metrics

### Enterprise Plan
- Sve iz Premium plana
- Upravljanje korisnicima
- Export podataka
- Automation
- Integrations
- SLA monitoring

## 🔧 API Endpoints

### Autentifikacija
- `POST /api/auth/register` - Registracija korisnika
- `POST /api/auth/login` - Prijava korisnika
- `GET /api/auth/me` - Dobijanje trenutnog korisnika
- `PUT /api/auth/profile` - Ažuriranje profila

### Tiketi
- `GET /api/tickets` - Lista tiketa
- `POST /api/tickets` - Kreiranje tiketa
- `GET /api/tickets/:id` - Detalji tiketa
- `PUT /api/tickets/:id` - Ažuriranje tiketa
- `POST /api/tickets/:id/comments` - Dodavanje komentara
- `POST /api/tickets/:id/time-entries` - Time tracking (Premium)

### Kompanije
- `GET /api/companies` - Lista kompanija (Admin only)
- `POST /api/companies` - Kreiranje kompanije
- `GET /api/companies/:id` - Detalji kompanije
- `PUT /api/companies/:id` - Ažuriranje kompanije
- `DELETE /api/companies/:id` - Brisanje kompanije
- `POST /api/companies/:id/upgrade-subscription` - Upgrade subscription

### Korisnici
- `GET /api/users` - Lista korisnika (Admin/Manager)
- `GET /api/users/agents` - Lista agenata
- `PUT /api/users/:id` - Ažuriranje korisnika
- `POST /api/users/:id/upgrade-subscription` - Upgrade subscription

### Analitika
- `GET /api/analytics/overview` - Pregled analitike (Premium)
- `GET /api/analytics/trends` - Trendovi (Premium)
- `GET /api/analytics/performance` - Performance metrics (Premium)
- `GET /api/analytics/export` - Export podataka (Enterprise)

## 🎨 UI Komponente

Aplikacija koristi Material-UI sa prilagođenim temom koja uključuje:
- Moderni gradient dizajn
- Responsive layout
- Dark/Light tema podrška
- Animacije i tranzicije
- Accessibility features

## 🔒 Sigurnost

- JWT autentifikacija
- Password hashing sa bcrypt
- Role-based access control
- Input validation
- Rate limiting
- CORS konfiguracija
- Helmet security headers

## 📱 Responsive Dizajn

Aplikacija je potpuno responsive i radi na:
- Desktop računarima
- Tablet uređajima
- Mobilnim telefonima

## 🚀 Deployment

### Production Build
```bash
# Build frontend
cd client
npm run build

# Start production server
cd ../server
npm start
```

### Environment Variables za Production
```env
NODE_ENV=production
PORT=5000
MONGO_URI=your-production-mongodb-uri
JWT_SECRET=your-production-jwt-secret
CLIENT_URL=https://your-domain.com
```

## 🤝 Doprinosi

1. Fork repozitorijuma
2. Kreirajte feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit promene (`git commit -m 'Add some AmazingFeature'`)
4. Push na branch (`git push origin feature/AmazingFeature`)
5. Otvorite Pull Request

## 📄 Licenca

Ovaj projekat je licenciran pod MIT licencom.

## 📞 Podrška

Za podršku i pitanja:
- Email: support@infrasync.com
- Dokumentacija: https://docs.infrasync.com
- Issues: GitHub Issues

---

**InfraSync** - Premium Helpdesk Solution za moderne kompanije 🚀 