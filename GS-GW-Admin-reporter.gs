/**
 * Google Apps Script to list all admin accounts in a Google Workspace and report suspended accounts via email.
 * 
 * Created by Jonas Lund 2023
 * 
 * To run this script:
 * 1. Make sure the Admin SDK Directory API is enabled.
 * 2. Make sure the Gmail API is enabled.
 * 3. Make sure the script is running with admin credentials for API calls.
 * 4. Set an email adress (further down in the code) to recieve what accounts are suspended admins. I recomend a group email and not the same email account that the script is running from. 
 */

function listAllAdminsToSheet() {
  // Initialize Google Sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Clear previous data
  sheet.clear();
  
  // Add column headers
  sheet.appendRow(['Email', 'Admin Roles', 'Last Login', 'Created', 'Is Admin', 'Is Delegated Admin', 'Is Suspended']);
  
  // Freeze the first row
  sheet.setFrozenRows(1);
  
  // Make the text bold in the first row
  sheet.getRange('1:1').setFontWeight('bold');
  
  // Initialize array to store suspended users
  var suspendedUsers = [];
  
  // Initialize retry variables
  var retryCount = 0;
  var maxRetries = 3;
  
  // Initialize page token for pagination
  var pageToken;
  
  // Main loop to fetch and process users
  do {
    var success = false; // Reset success flag
    
    // Retry logic
    while (!success && retryCount < maxRetries) {
      try {
        // Fetch users
        var users = AdminDirectory.Users.list({
          customer: 'my_customer',
          viewType: 'admin_view',
          pageToken: pageToken
        });
        
        // Set success flag to true if API call succeeds
        success = true;
      } catch (e) {
        // Log the error and retry
        Logger.log("Error fetching users. Retrying... " + e);
        Utilities.sleep(2000); // Wait for 2 seconds
        retryCount++;
      }
    }
    
    // If the API call was successful
    if (success) {
      // Loop through each user and process
      if (users.users && users.users.length > 0) {
        for (var i = 0; i < users.users.length; i++) {
          var user = users.users[i];
          
          // Check if the user is an admin or delegated admin
          if (user.isAdmin || user.isDelegatedAdmin) {
            // Additional processing and appending to sheet
            
            // Extract roles, login time, creation time, admin status, delegated admin status, and suspension status
            var roles = 'N/A';
            if ('customSchemas' in user && 'EnhancedAdmin' in user.customSchemas) {
              roles = user.customSchemas.EnhancedAdmin.AdminRoles;
            }
            
            var lastLogin = user.lastLoginTime ? new Date(user.lastLoginTime).toLocaleString() : 'N/A';
            var created = user.creationTime ? new Date(user.creationTime).toLocaleString() : 'N/A';
            var isAdmin = user.isAdmin ? 'True' : 'False';
            var isDelegatedAdmin = user.isDelegatedAdmin ? 'True' : 'False';
            var isSuspended = user.suspended ? 'True' : 'False';
            
            // Append data to the Google Sheet
            sheet.appendRow([user.primaryEmail, roles, lastLogin, created, isAdmin, isDelegatedAdmin, isSuspended]);
            
            // If user is suspended, add to suspendedUsers array
            if (isSuspended === 'True') {
              suspendedUsers.push(user.primaryEmail);
            }
          }
        }
      }
      
      // Update the page token for the next batch
      pageToken = users.nextPageToken;
    } else {
      // Log an error message and exit the loop if max retries are reached
      Logger.log("Max retries reached. Exiting...");
      return;
    }
    
  } while (pageToken); // Continue while there are more users to fetch
  
  // Send an email if there are suspended users Set the email to a group or an account
  if (suspendedUsers.length > 0) {
    var emailAddress = 'youremail@yourdomain.com'; // Add your prefered group or email
    var subject = 'List of Suspended Admins';
    var message = 'The following admin accounts are suspended: \n' + suspendedUsers.join('\n');
    
    // Log details about the email being sent
    Logger.log("Sending email to " + emailAddress);
    Logger.log("Email content: " + message);
    
    try {
      // Send the email
      MailApp.sendEmail(emailAddress, subject, message);
      Logger.log("Email sent successfully");
    } catch (e) {
      // Log any errors
      Logger.log("Failed to send email: " + e.message);
    }
  } else {
    // Log if there are no suspended users
    Logger.log("No suspended users found");
  }
}
