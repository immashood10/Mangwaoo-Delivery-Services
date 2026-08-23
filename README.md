# Mangwaoo.com - Frontend

A modern, scalable, and fully responsive frontend for Mangwaoo.com, Karachi's trusted delivery service. Built with Next.js 15, React, TypeScript, and Tailwind CSS.

## 🎯 About Mangwaoo

**Mangwaoo** is a local delivery service in Karachi offering:
- 🍔 Fast Food Delivery
- 🛒 Grocery Delivery
- 🥛 Dairy Items Delivery
- 💊 Medicine Delivery

**Tagline**: "Time Bachao, Mangwaoo Chalao!" (Save time, order from Mangwaoo!)

**Service Hours**: 12:00 PM to 1:00 AM daily

**Current Coverage Areas**: North Karachi, Nagan Chowrangi, Bufferzone, Disco Mor, UP Mor

## 🚀 Features

- ✅ **Fully Responsive Design** - Mobile, tablet, and desktop optimized
- ✅ **Modern UI/UX** - Premium startup-level design with smooth animations
- ✅ **SEO Optimized** - Metadata and structured data for all pages
- ✅ **Performance Focused** - Optimized assets and fast loading
- ✅ **Scalable Architecture** - Ready for multi-vendor expansion
- ✅ **Smooth Animations** - Powered by Framer Motion
- ✅ **Sticky Navigation** - Easy access to main navigation
- ✅ **Floating WhatsApp Button** - Quick contact option
- ✅ **Scroll-to-Top Button** - Better UX for long pages
- ✅ **Dark Mode Ready** - Prepared for future dark mode support

## 📁 Project Structure

```
mangwaoo/
├── app/
│   ├── (routes)/
│   │   ├── about/page.tsx
│   │   ├── services/page.tsx
│   │   ├── areas/page.tsx
│   │   └── contact/page.tsx
│   ├── page.tsx (Home)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── ServicesSection.tsx
│   ├── WhyChooseUs.tsx
│   ├── ServiceAreas.tsx
│   ├── Testimonials.tsx
│   ├── FutureVision.tsx
│   ├── CTASection.tsx
│   ├── Footer.tsx
│   ├── WhatsAppButton.tsx
│   └── ScrollToTop.tsx
├── lib/
│   ├── data.ts (Centralized data/content)
│   └── utils.ts (Utility functions)
├── public/
├── tailwind.config.ts
└── next.config.ts
```

## 🎨 Brand Colors

- **Primary Red**: `#9B0000`
- **Secondary Red**: `#C1121F`
- **Dark**: `#111111`
- **Light Gray**: `#F8F8F8`
- **Text Gray**: `#666666`
- **White**: `#FFFFFF`

## 📄 Pages

### 1. **Home** (`/`)
- Hero section with headline and CTA buttons
- Services overview
- Why choose us section
- Service areas showcase
- Customer testimonials
- Future vision roadmap
- Final CTA section

### 2. **About** (`/about`)
- Company story and mission
- Vision statement
- Team values
- Growth roadmap
- Core values showcase

### 3. **Services** (`/services`)
- Detailed service cards for all 4 categories
- How it works process
- Service hours and coverage info
- Service area listings

### 4. **Service Areas** (`/areas`)
- Coverage map visualization
- Area details and benefits
- Expansion plans
- Delivery availability checker

### 5. **Contact** (`/contact`)
- Contact form
- Contact information
- WhatsApp, phone, email options
- FAQ section
- Quick response message

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Package Manager**: npm

## 📦 Installation

1. **Clone the repository**:
   ```bash
   cd mangwaoo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables** (if needed):
   ```bash
   cp .env.example .env.local
   ```

## 🚀 Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the site.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🏗️ Building for Production

```bash
npm run build
npm run start
```

## 📱 Responsive Design

The website is fully responsive and optimized for:
- 📱 Mobile (320px and up)
- 📱 Tablet (768px and up)
- 💻 Desktop (1024px and up)

## 🔍 SEO Features

- Meta tags for all pages
- Open Graph tags
- Structured data ready
- Clean URL structure
- Mobile-friendly design
- Fast page load times

## 🌟 Key Components

### **Navbar**
- Sticky navigation
- Mobile hamburger menu
- WhatsApp CTA button
- Smooth scroll links

### **Hero Section**
- Animated headline and subheadline
- Call-to-action buttons
- Trust badges with stats
- Animated delivery rider illustration

### **Services Section**
- 4 service cards with icons
- Hover animations
- Category-specific descriptions

### **Why Choose Us**
- 6 key feature cards
- Icon-based design
- Hover effects

### **Service Areas**
- Area listing with map visualization
- Status badges
- Expansion plans section

### **Testimonials**
- Customer reviews with ratings
- User avatars
- Star ratings

### **Future Vision**
- Multi-phase roadmap
- Feature highlights
- Timeline visualization

### **WhatsApp Button**
- Floating action button
- Pulsing animation
- Direct WhatsApp link

### **Scroll-to-Top Button**
- Appears after scrolling
- Smooth scroll animation
- Branded colors

## 🔐 Brand Information

- **Name**: Mangwaoo.com
- **WhatsApp**: 0315-0699930
- **WhatsApp Link**: https://wa.me/923150699930
- **Email**: hello@mangwaoo.com
- **Service Hours**: 12:00 PM - 1:00 AM daily

## 📈 Future Enhancements

The architecture is designed to support:
- Multi-vendor marketplace
- Mobile apps (iOS & Android)
- Vendor dashboards
- Real-time order tracking
- Online payment integration
- Ratings and reviews system
- Promotional coupons
- Subscription plans

## 🚀 Deployment

The project is ready to be deployed on:
- **Vercel** (recommended - official Next.js hosting)
- **Netlify**
- **AWS**
- **DigitalOcean**
- **Any Node.js hosting

### Deploy on Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

## 📝 Customization

To customize the content:

1. **Update brand data**: Edit `lib/data.ts`
2. **Modify colors**: Update `tailwind.config.ts` and `app/globals.css`
3. **Change text**: Update component content directly or in `lib/data.ts`
4. **Add new sections**: Create new components and integrate into pages

## 🤝 Contributing

To contribute to this project:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

This project is proprietary to Mangwaoo.com. All rights reserved.

## 📞 Support

For questions or support:
- **WhatsApp**: [Chat with us](https://wa.me/923150699930)
- **Email**: hello@mangwaoo.com
- **Phone**: +92 315 0699930

---

**Built with ❤️ for Karachi**

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
