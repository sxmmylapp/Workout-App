function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Workouts');
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Workouts');
  }
  
  var data = JSON.parse(e.postData.contents);
  var workout = data.workout;
  var sets = data.sets;
  
  // Ensure headers exist in row 1
  ensureHeaders(sheet);
  
  // Add each set as a row
  for (var i = 0; i < sets.length; i++) {
    var set = sets[i];
    sheet.appendRow([
      workout.date,
      workout.id,
      workout.name,
      set.exerciseName,
      set.setNumber,
      set.weight,
      set.reps
    ]);
  }
  
  return ContentService.createTextOutput(JSON.stringify({success: true}))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureHeaders(sheet) {
  var headers = ['Date', 'Workout ID', 'Workout Name', 'Exercise', 'Set #', 'Weight (lbs)', 'Reps'];
  
  // Check if row 1 has the correct headers
  if (sheet.getLastRow() === 0) {
    // Sheet is empty, add headers
    sheet.appendRow(headers);
  } else {
    // Check first cell - if it doesn't look like a header, insert header row
    var firstCell = sheet.getRange(1, 1).getValue();
    if (firstCell !== 'Date') {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
}

function doGet(e) {
  var action = e.parameter.action;
  
  if (action === 'getHistory') {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Workouts');
    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService.createTextOutput(JSON.stringify({workouts: []}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getDataRange().getValues();
    var rows = data.slice(1); // Skip headers
    
    // Group by workout ID
    var workoutsMap = {};
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var date = row[0];
      var workoutId = row[1];
      var name = row[2];
      var exercise = row[3];
      var setNum = row[4];
      var weight = row[5];
      var reps = row[6];
      
      if (!workoutsMap[workoutId]) {
        workoutsMap[workoutId] = {
          date: date,
          name: name,
          exercises: {}
        };
      }
      
      if (!workoutsMap[workoutId].exercises[exercise]) {
        workoutsMap[workoutId].exercises[exercise] = { name: exercise, sets: [] };
      }
      
      workoutsMap[workoutId].exercises[exercise].sets.push({
        setNumber: setNum,
        weight: weight,
        reps: reps
      });
    }
    
    // Convert to array, sorted newest first
    var workoutIds = Object.keys(workoutsMap);
    var workouts = [];
    for (var j = 0; j < workoutIds.length; j++) {
      var w = workoutsMap[workoutIds[j]];
      var exerciseNames = Object.keys(w.exercises);
      var exerciseList = [];
      for (var k = 0; k < exerciseNames.length; k++) {
        exerciseList.push(w.exercises[exerciseNames[k]]);
      }
      workouts.push({
        date: w.date,
        name: w.name,
        exercises: exerciseList
      });
    }
    workouts.sort(function(a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    
    return ContentService.createTextOutput(JSON.stringify({workouts: workouts}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: 'Unknown action'}))
    .setMimeType(ContentService.MimeType.JSON);
}
