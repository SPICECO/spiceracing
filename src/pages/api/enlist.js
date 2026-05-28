import { supabaseAdmin } from "@/lib/supabase";

export const prerender = false;

export const POST = async ({ request }) => {
  try {
    const text = await request.text();
    let firstName = null;
    let lastName = null;
    let email = null;
    let raceName = null;
    let raceDate = null;

    // 1. Try parsing as JSON
    try {
      const body = JSON.parse(text);
      firstName = body?.first_name;
      lastName = body?.last_name;
      email = body?.email;
      raceName = body?.race_name;
      raceDate = body?.race_date;
    } catch {
      // Not JSON
    }

    // 2. Try parsing as URL Search Params (x-www-form-urlencoded)
    if (!firstName || !lastName || !email || !raceName) {
      const params = new URLSearchParams(text);
      firstName = params.get('first_name') || firstName;
      lastName = params.get('last_name') || lastName;
      email = params.get('email') || email;
      raceName = params.get('race_name') || raceName;
      raceDate = params.get('race_date') || raceDate;
    }

    // 3. Try parsing as multipart form data using Regex
    const fields = ['first_name', 'last_name', 'email', 'race_name', 'race_date'];
    const data = {};
    fields.forEach(field => {
      const regex = new RegExp(`name="${field}"[\\s\\S]*?\\r?\\n\\r?\\n([^\\r\\n]+)`);
      const match = text.match(regex);
      if (match) {
        data[field] = match[1].trim();
      }
    });

    firstName = firstName || data.first_name;
    lastName = lastName || data.last_name;
    email = email || data.email;
    raceName = raceName || data.race_name;
    raceDate = raceDate || data.race_date;

    if (!firstName || !lastName || !email || !raceName) {
      return new Response(
        JSON.stringify({ success: false, message: 'First name, last name, email, and race name are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get or create race
    let { data: race, error: raceError } = await supabaseAdmin
        .from('races')
        .select('race_id')
        .eq('race_name', raceName)
        .maybeSingle();

    if (raceError) throw raceError;

    if (!race) {
        const { data: newRace, error: newRaceError } = await supabaseAdmin
            .from('races')
            .insert({
                race_name: raceName,
                race_date: raceDate || null,
                status: 'planned'
            })
            .select('race_id')
            .single();
        if (newRaceError) throw newRaceError;
        race = newRace;
    }

    // 2. Get or create participant
    let { data: participant, error: partError } = await supabaseAdmin
        .from('participants')
        .select('participant_id')
        .eq('email', email)
        .maybeSingle();

    if (partError) throw partError;

    if (!participant) {
        const { data: newParticipant, error: newPartError } = await supabaseAdmin
            .from('participants')
            .insert({
                first_name: firstName,
                last_name: lastName,
                email: email
            })
            .select('participant_id')
            .single();
        if (newPartError) throw newPartError;
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
        if (regError.code === '23505') { // Postgres unique constraint error code
            return new Response(
              JSON.stringify({ success: false, message: 'You are already registered for this event.' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }
        throw regError;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Successfully registered for this event!' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error("Error in enlist API:", err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Server error occurred.' }),
      { status: 550, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
