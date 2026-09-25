# Kishore Studios 📸

Premium photography portfolio and client-facing gallery for **Kishore Studios**.

## What is included

- Luxury, responsive public photography website
- Wedding, pre-wedding, event and portrait sections
- Live gallery backed by Supabase
- Private admin login using Supabase Auth
- Admin upload of images and videos to Cloudinary
- Admin gallery management/removal
- WhatsApp and phone enquiry buttons
- GitHub Pages deployment workflow

## Services used

- **GitHub Pages:** public static website hosting
- **Supabase:** authentication and gallery metadata
- **Cloudinary:** image/video storage and delivery

## Configuration

Edit `config.js` and add only the public client values:

- Supabase project URL
- Supabase publishable/anon key
- Cloudinary cloud name
- Cloudinary unsigned upload preset (`kishore_gallery`)

Never put a Supabase `service_role` key or Cloudinary API secret in frontend files.

## Admin

Open `/admin.html` and sign in with the Kishore Studios Supabase account.

The public website never asks visitors to sign in.

## Important Cloudinary note

The current browser upload flow uses an unsigned Cloudinary upload preset. Cloudinary documents that unsigned preset names are visible to clients, so the preset should be restricted to appropriate formats/folders and rotated if abused. For a stronger production setup, move uploads behind a signed Supabase Edge Function so the Cloudinary API secret never reaches the browser.
