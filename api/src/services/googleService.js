const { google } = require('googleapis');
const logger = require('../utils/logger');

class GoogleService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Set credentials from stored tokens
   */
  setCredentials(accessToken, refreshToken) {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }

  /**
   * Generate OAuth URL for user consent
   */
  getAuthUrl(scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ]) {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Generate OAuth URL for connecting Google account (includes state)
   */
  getConnectUrl(userId, tenantId) {
    const state = Buffer.from(JSON.stringify({ userId, tenantId })).toString('base64');
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      prompt: 'consent',
      state
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      };
    } catch (err) {
      logger.error('Google OAuth token exchange failed', { error: err.message });
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return {
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      };
    } catch (err) {
      logger.error('Google token refresh failed', { error: err.message });
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Create consultation event with Google Meet link
   */
  async createConsultationEvent({
    organizerEmail,
    organizerRefreshToken,
    attendeeEmails = [],
    title,
    description,
    startDateTime,
    endDateTime,
    timeZone = 'Asia/Kolkata',
    addGoogleMeet = true,
    location = null
  }) {
    try {
      // Set credentials using organizer's refresh token
      this.oauth2Client.setCredentials({ refresh_token: organizerRefreshToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Build attendees array
      const attendees = attendeeEmails.map(email => ({
        email,
        responseStatus: 'needsAction'
      }));

      // Build event object
      const event = {
        summary: title,
        description,
        start: {
          dateTime: startDateTime,
          timeZone
        },
        end: {
          dateTime: endDateTime,
          timeZone
        },
        attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 15 },
            { method: 'email', minutes: 60 }
          ]
        }
      };

      // Add location if provided
      if (location) {
        event.location = location;
      }

      // Add Google Meet conference if requested
      if (addGoogleMeet) {
        event.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        };
      }

      // Create the event
      const result = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: addGoogleMeet ? 1 : 0,
        sendUpdates: 'all'
      });

      const eventData = result.data;
      return {
        eventId: eventData.id,
        htmlLink: eventData.htmlLink,
        meetLink: eventData.conferenceData?.entryPoints?.[0]?.uri || null,
        meetId: eventData.conferenceData?.conferenceId || null,
        conferenceId: eventData.conferenceData?.conferenceId || null,
        startTime: eventData.start.dateTime,
        endTime: eventData.end.dateTime
      };
    } catch (err) {
      logger.error('Failed to create consultation event', {
        error: err.message,
        organizerEmail
      });
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Update consultation event
   */
  async updateConsultationEvent({
    eventId,
    calendarId = 'primary',
    organizerRefreshToken,
    updates
  }) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: organizerRefreshToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Get existing event
      const existingEvent = await calendar.events.get({
        calendarId,
        eventId
      });

      // Apply updates
      const updatedEvent = {
        ...existingEvent.data,
        ...updates
      };

      const result = await calendar.events.update({
        calendarId,
        eventId,
        resource: updatedEvent,
        sendUpdates: 'all'
      });

      return {
        eventId: result.data.id,
        htmlLink: result.data.htmlLink,
        startTime: result.data.start.dateTime,
        endTime: result.data.end.dateTime
      };
    } catch (err) {
      logger.error('Failed to update consultation event', {
        error: err.message,
        eventId
      });
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Cancel/delete consultation event
   */
  async cancelConsultationEvent({
    eventId,
    calendarId = 'primary',
    organizerRefreshToken,
    sendNotifications = true
  }) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: organizerRefreshToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: sendNotifications ? 'all' : 'none'
      });

      return { success: true };
    } catch (err) {
      logger.error('Failed to cancel consultation event', {
        error: err.message,
        eventId
      });
      throw new Error('Failed to cancel calendar event');
    }
  }

  /**
   * Get free/busy slots for a clinician
   */
  async getFreeBusy({
    calendarIds,
    timeMin,
    timeMax,
    refreshToken
  }) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const result = await calendar.freebusy.query({
        resource: {
          timeMin,
          timeMax,
          items: calendarIds.map(id => ({ id }))
        }
      });

      const busySlots = [];
      for (const [calendarId, data] of Object.entries(result.data.calendars)) {
        if (data.busy) {
          busySlots.push(...data.busy);
        }
      }

      // Sort busy slots by start time
      busySlots.sort((a, b) => new Date(a.start) - new Date(b.start));

      // Compute free slots (9am-6pm IST working hours)
      const freeSlots = this._computeFreeSlots(busySlots, timeMin, timeMax);

      return {
        busySlots,
        freeSlots
      };
    } catch (err) {
      logger.error('Failed to get free/busy information', {
        error: err.message,
        calendarIds
      });
      throw new Error('Failed to retrieve availability');
    }
  }

  /**
   * List upcoming events for a clinician
   */
  async listEvents({
    calendarId,
    refreshToken,
    timeMin,
    timeMax,
    maxResults = 20
  }) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const result = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return result.data.items || [];
    } catch (err) {
      logger.error('Failed to list calendar events', {
        error: err.message,
        calendarId
      });
      throw new Error('Failed to list events');
    }
  }

  /**
   * Compute free slots from busy slots within working hours
   */
  _computeFreeSlots(busySlots, timeMin, timeMax) {
    const WORKING_HOURS = {
      start: 9,  // 9 AM
      end: 18    // 6 PM
    };
    const DURATION_MINUTES = 60;

    const freeSlots = [];
    const timeMinDate = new Date(timeMin);
    const timeMaxDate = new Date(timeMax);

    let currentTime = new Date(timeMinDate);

    while (currentTime < timeMaxDate) {
      const slotEnd = new Date(currentTime.getTime() + DURATION_MINUTES * 60000);

      // Check if within working hours
      if (currentTime.getHours() >= WORKING_HOURS.start &&
          slotEnd.getHours() <= WORKING_HOURS.end) {
        // Check if slot is free (not in any busy slot)
        const isFree = !busySlots.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return (currentTime < busyEnd && slotEnd > busyStart);
        });

        if (isFree) {
          freeSlots.push({
            start: currentTime.toISOString(),
            end: slotEnd.toISOString()
          });
        }
      }

      currentTime = new Date(currentTime.getTime() + 30 * 60000); // 30-minute increments
    }

    return freeSlots;
  }
}

module.exports = new GoogleService();
