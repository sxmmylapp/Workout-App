"""
Google Sheets OAuth Authentication Script

Run this script once to authenticate with your personal Google account
and generate the token.json file for API access.

Usage: python auth_sheets.py
"""

import os
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Scopes needed for Google Sheets and Drive
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
]

# Path to your client secret file
CLIENT_SECRET_FILE = 'client_secret_511081201346-p9ce3ck1qoojd8qlev6bccel826e8nvs.apps.googleusercontent.com.json'
TOKEN_FILE = 'token.json'

def get_credentials():
    """Get or refresh OAuth credentials."""
    creds = None
    
    # Check if token.json exists
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    # If no valid credentials, run the OAuth flow
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing expired token...")
            creds.refresh(Request())
        else:
            print("Starting OAuth flow...")
            print("A browser window will open. Sign in with your PERSONAL Google account.")
            print()
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save the credentials
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
            print(f"✅ Credentials saved to {TOKEN_FILE}")
    
    return creds

def create_workout_spreadsheet(creds):
    """Create the Workout App spreadsheet with proper structure."""
    service = build('sheets', 'v4', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    
    # Create the spreadsheet
    spreadsheet = {
        'properties': {'title': 'Workout App Database'},
        'sheets': [
            {
                'properties': {'title': 'Exercises'},
                'data': [{
                    'rowData': [{
                        'values': [
                            {'userEnteredValue': {'stringValue': 'id'}},
                            {'userEnteredValue': {'stringValue': 'name'}},
                            {'userEnteredValue': {'stringValue': 'muscleGroup'}},
                            {'userEnteredValue': {'stringValue': 'equipment'}}
                        ]
                    }]
                }]
            },
            {
                'properties': {'title': 'Workouts'},
                'data': [{
                    'rowData': [{
                        'values': [
                            {'userEnteredValue': {'stringValue': 'id'}},
                            {'userEnteredValue': {'stringValue': 'name'}},
                            {'userEnteredValue': {'stringValue': 'startTime'}},
                            {'userEnteredValue': {'stringValue': 'endTime'}},
                            {'userEnteredValue': {'stringValue': 'status'}}
                        ]
                    }]
                }]
            },
            {
                'properties': {'title': 'Sets'},
                'data': [{
                    'rowData': [{
                        'values': [
                            {'userEnteredValue': {'stringValue': 'id'}},
                            {'userEnteredValue': {'stringValue': 'workoutId'}},
                            {'userEnteredValue': {'stringValue': 'exerciseId'}},
                            {'userEnteredValue': {'stringValue': 'setNumber'}},
                            {'userEnteredValue': {'stringValue': 'weight'}},
                            {'userEnteredValue': {'stringValue': 'reps'}},
                            {'userEnteredValue': {'stringValue': 'rpe'}},
                            {'userEnteredValue': {'stringValue': 'completed'}},
                            {'userEnteredValue': {'stringValue': 'timestamp'}}
                        ]
                    }]
                }]
            }
        ]
    }
    
    result = service.spreadsheets().create(body=spreadsheet).execute()
    spreadsheet_id = result['spreadsheetId']
    spreadsheet_url = result['spreadsheetUrl']
    
    print(f"\n✅ Created spreadsheet: {result['properties']['title']}")
    print(f"📊 Spreadsheet ID: {spreadsheet_id}")
    print(f"🔗 URL: {spreadsheet_url}")
    
    # Save the spreadsheet ID for app usage
    config = {
        'spreadsheet_id': spreadsheet_id,
        'spreadsheet_url': spreadsheet_url
    }
    with open('sheets_config.json', 'w') as f:
        json.dump(config, f, indent=2)
    print(f"\n✅ Config saved to sheets_config.json")
    
    return spreadsheet_id

def main():
    print("=" * 50)
    print("Workout App - Google Sheets Setup")
    print("=" * 50)
    print()
    
    # Step 1: Authenticate
    creds = get_credentials()
    print("✅ Authentication successful!")
    print()
    
    # Step 2: Create spreadsheet
    print("Creating Workout App Database spreadsheet...")
    spreadsheet_id = create_workout_spreadsheet(creds)
    
    print()
    print("=" * 50)
    print("Setup complete! Your spreadsheet is ready.")
    print("=" * 50)

if __name__ == '__main__':
    main()
