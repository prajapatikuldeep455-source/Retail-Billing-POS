/**
 * GOOGLE SHEETS BACKGROUND VERIFICATION SYSTEM
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Set up the following columns in row 1:
 *    A: Timestamp
 *    B: HD ID
 *    C: Owner Name
 *    D: Shop Name
 *    E: Email
 *    F: Phone
 *    G: Plan
 *    H: Expiry Date
 *    I: Status (active, trial, expired, suspended)
 *    J: Action
 *    K: Amount
 *    L: Transaction ID
 * 3. Go to Extensions > Apps Script.
 * 4. Paste this entire code, replacing the default code.
 * 5. Click "Deploy" > "New deployment".
 * 6. Select type: "Web app".
 * 7. Execute as: "Me" and Who has access: "Anyone".
 * 8. Copy the Web App URL.
 * 9. Paste the URL into your project's .env file as:
 *    LICENSE_SHEET_WEBHOOK="https://script.google.com/macros/s/.../exec"
 */

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  var action = data.action;
  var hdId = data.hd_id;
  
  // 1. Search for existing HD ID
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var existingRowIndex = -1;
  var serverStatus = 'active';
  var serverExpiry = data.expiry;
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][1] === hdId) { // Column B is HD ID
      existingRowIndex = i + 1;
      
      // If action is VERIFY, we read from the sheet and return it
      if (action === 'VERIFY') {
        serverStatus = values[i][8] || 'active'; // Column I is Status
        var potentialExpiry = values[i][7];      // Column H is Expiry
        if (potentialExpiry) {
          serverExpiry = new Date(potentialExpiry).toISOString();
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          status: serverStatus,
          expiry: serverExpiry,
          message: "Verified from server"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      break;
    }
  }
  
  // 2. If action is REGISTER_TRIAL or ACTIVATE_PAYMENT
  if (action === 'REGISTER_TRIAL' || action === 'ACTIVATE_PAYMENT') {
    var rowData = [
      data.timestamp || new Date(),
      hdId,
      data.owner_name || '',
      data.shop_name || '',
      data.email || '',
      data.phone || '',
      data.current_plan || '',
      data.expiry || '',
      (action === 'REGISTER_TRIAL' ? 'trial' : 'active'),
      action,
      data.amount || 0,
      data.transaction_id || ''
    ];
    
    if (existingRowIndex > -1) {
      // Update existing
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // Append new
      sheet.appendRow(rowData);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Data saved to Google Sheets"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // 3. Fallback
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: "Unknown action"
  })).setMimeType(ContentService.MimeType.JSON);
}
