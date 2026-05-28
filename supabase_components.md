# Supabase Component Integration Guide

This document covers the implementation, schemas, and logic flow of the **Newsletter Subscription Form** and the **Race Enlistment Form** as we migrate to the new codebase.

---

## 1. Architectural Overview

Both components use **progressive enhancement** to submit forms asynchronously without page reloads. In SvelteKit, this is done via SvelteKit Page Actions (`+/subscribe` and `+/enlist`), keeping our private Supabase keys safe on the server side.

When migrating to a different framework (like Astro running on `http://localhost:5173/`), you will need to map these server actions to standard API endpoints (e.g., POST endpoints at `/api/subscribe` and `/api/enlist`).

---

## 2. Newsletter Component (`NewsletterForm.svelte`)

A minimal, brand-aligned subscription form that inserts emails into the database.

### A. Frontend Form Implementation
- **Fields**: `email` (type: `email`, name: `email`, required)
- **Submit Action**: `?/subscribe` (POST)
- **State Properties**: `loading`, `success`, `error`

```html
<form 
    method="POST" 
    action="?/subscribe" 
    use:enhance={() => {
        loading = true;
        error = '';
        return async ({ update, result }) => {
            loading = false;
            await update({ reset: result.type === 'success' });
        };
    }}
>
    <input type="email" name="email" required placeholder="enter email to join newsletter" />
    <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'JOIN'}
    </button>
</form>
```

### B. Server-Side Supabase Query Action
Inserts the email record into the `newsletter_subscribers` table. Handles duplicate key violations (`23505`) gracefully.

```javascript
subscribe: async ({ request }) => {
    const formData = await request.formData();
    const email = formData.get('email');

    if (!email) {
        return fail(400, { email, error: 'EMAIL IS REQUIRED' });
    }

    // Insert record into Supabase
    const { error } = await supabase
        .from('newsletter_subscribers')
        .insert([{ email }]);

    if (error) {
        if (error.code === '23505') { // Postgres duplicate key error code
            return fail(400, { email, error: 'THIS EMAIL IS ALREADY REGISTERED' });
        }
        return fail(500, { email, error: 'TRANSMISSION ERROR. PLEASE TRY AGAIN.' });
    }

    return { success: true };
}
```

---

## 3. Race Enlistment Component (`RaceEnlist.svelte`)

Allows users to register for next events. The component matches upcoming events parsed from the Google Calendar iCal feed.

### A. Frontend Form Implementation
- **Fields**: `first_name`, `last_name`, `email`
- **Hidden Fields**: `race_name`, `race_date` (pre-filled from calendar event summary and start date)
- **Submit Action**: `?/enlist` (POST)

```html
<form 
    method="POST" 
    action="?/enlist" 
    use:enhance={() => {
        loading = true;
        error = '';
        return async ({ update, result }) => {
            if (result.type === 'success') success = true;
            await update({ reset: result.type === 'success' });
            loading = false;
        };
    }}
>
    <!-- Hidden inputs to identify the target event -->
    <input type="hidden" name="race_name" value={event.summary} />
    <input type="hidden" name="race_date" value={event.start} />

    <input type="text" name="first_name" placeholder="FIRST NAME" required />
    <input type="text" name="last_name" placeholder="LAST NAME" required />
    <input type="email" name="email" placeholder="EMAIL ADDRESS" required />

    <button type="submit" disabled={loading}>ENLIST FOR RACE</button>
</form>
```

### B. Server-Side Transaction Logic (Supabase)
This action performs a multi-step transaction using `supabaseAdmin` to query and relate tables:

1. **Race Creation/Lookup**: Looks up the race in the `races` table by name. If it doesn't exist, it creates a new race record.
2. **Participant Creation/Lookup**: Queries the `participants` table by email. If the user doesn't exist, it inserts a new participant profile.
3. **Registration Insertion**: Connects the participant to the race inside the `race_registrations` join table. Enforces a uniqueness constraint (`unique(participant_id, race_id)`).

```javascript
enlist: async ({ request }) => {
    const formData = await request.formData();
    const firstName = formData.get('first_name');
    const lastName = formData.get('last_name');
    const email = formData.get('email');
    const raceName = formData.get('race_name');
    const raceDate = formData.get('race_date');

    try {
        // 1. Get or create race
        let { data: race } = await supabaseAdmin
            .from('races')
            .select('race_id')
            .eq('race_name', raceName)
            .single();

        if (!race) {
            const { data: newRace } = await supabaseAdmin
                .from('races')
                .insert({
                    race_name: raceName,
                    race_date: raceDate,
                    status: 'planned'
                })
                .select()
                .single();
            race = newRace;
        }

        // 2. Get or create participant
        let { data: participant } = await supabaseAdmin
            .from('participants')
            .select('participant_id')
            .eq('email', email)
            .single();

        if (!participant) {
            const { data: newParticipant } = await supabaseAdmin
                .from('participants')
                .insert({
                    first_name: firstName,
                    last_name: lastName,
                    email: email
                })
                .select()
                .single();
            participant = newParticipant;
        }

        // 3. Register participant for the race
        const { error: regError } = await supabaseAdmin
            .from('race_registrations')
            .insert({
                participant_id: participant.participant_id,
                race_id: race.race_id,
                registration_status: 'registered'
            });

        if (regError) {
            if (regError.code === '23505') {
                return fail(400, { success: false, message: 'You are already registered for this event.' });
            }
            throw regError;
        }

        return { success: true };
    } catch (err) {
        return fail(500, { success: false, message: err.message || 'Server error.' });
    }
}
```

---

## 4. Supabase Database Schema

Below are the SQL statements required to rebuild the tables in the Supabase workspace:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Newsletter table
create table newsletter_subscribers (
    id uuid primary key default uuid_generate_v4(),
    email text unique not null,
    created_at timestamptz default now()
);

-- Participants table
create table participants (
    participant_id uuid primary key default uuid_generate_v4(),
    first_name text not null,
    last_name text not null,
    email text unique not null,
    phone text,
    created_at timestamptz default now()
);

-- Races table
create table races (
    race_id uuid primary key default uuid_generate_v4(),
    race_name text not null,
    race_date timestamptz,
    status text check (status in ('planned', 'active', 'finished')) default 'planned',
    created_at timestamptz default now()
);

-- Race Registrations join table
create table race_registrations (
    registration_id uuid primary key default uuid_generate_v4(),
    participant_id uuid references participants(participant_id) on delete cascade,
    race_id uuid references races(race_id) on delete cascade,
    registration_date timestamptz default now(),
    registration_status text check (registration_status in ('registered', 'cancelled', 'finished', 'DNF')) default 'registered',
    unique(participant_id, race_id) -- Prevent double registrations
);
```

---

## 5. Porting & Migration Guidelines for Astro (`localhost:5173`)

Since the target project uses Astro, SvelteKit's Page Actions (`?/subscribe` and `?/enlist`) will not exist. Follow these instructions to adapt the forms:

1. **Set Up Server Endpoints**: Create API route handlers in Astro (e.g., `src/pages/api/subscribe.json.js` and `src/pages/api/enlist.json.js`).
2. **Move Actions to API Handlers**: Migrate the server-side Supabase query scripts into Astro's `POST` handlers, parsing inputs via `await request.json()` or `await request.formData()`.
3. **Trigger via AJAX Fetch**:
   In Svelte/Astro components, replace SvelteKit's `enhance` logic with a standard `fetch` call:
   ```javascript
   const handleSubmit = async (event) => {
       loading = true;
       const formData = new FormData(event.currentTarget);
       
       const response = await fetch('/api/subscribe', {
           method: 'POST',
           body: formData
       });
       
       const result = await response.json();
       loading = false;
       if (result.success) {
           success = true;
       } else {
           error = result.message || 'Error occurred.';
       }
   };
   ```
