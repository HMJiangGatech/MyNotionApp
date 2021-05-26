require('dotenv').config();
var fs = require('fs');
const { GoogleSpreadsheet } = require('google-spreadsheet');

var cred = JSON.parse(fs.readFileSync('credential.json', 'utf8'));
const googleCreds = require('./google-credential.json');

// Initialize the sheet - doc ID is the long id in the sheets URL
const {Client} = require("@notionhq/client");
const notion = new Client({auth:cred['apiKey']}); 
const databaseId = cred['databaseId'];


//Get a paginated list of Tasks currently in a the database. 
async function getEntriesFromDatabase() {

    var allPages = [];

    async function getPages(cursor){
        let request_payload = "";
        //Create the request payload based on the presense of a start_cursor
        if(cursor == undefined){
            request_payload = {
                path:'databases/' + databaseId + '/query', 
                method:'POST',
            };
        } else {
            request_payload= {
                path:'databases/' + databaseId + '/query', 
                method:'POST',
                body:{
                    "start_cursor": cursor
                }
            };
        }
        //While there are more pages left in the query, get pages from the database. 
        const current_pages = await notion.request(request_payload);
        
        for(const page of current_pages.results){
            if(page.properties.Status){ 
                allPages.push(page);
            } else {
                allPages.push(page);
            }
        }
        if(current_pages.has_more){
            await getPages(current_pages.next_cursor);
        }
        
    }
    await getPages();
    // console.log(allPages)
    return allPages; 
}

async function syncNotion2GS(doc) {
    var allPages = await getEntriesFromDatabase(); 
    var cleanedData = [];
    var allExercise = [];
    var d = {};
    for(const page of allPages){
        d = page.properties;
        cleanedData.push({
            'Date': new Date(d['Date'].created_time),
            'Weight (KG)': d['Weight (KG)'].number,
            '👟 Workout': d['👟 Workout'].checkbox,
            '🍽 Fasting > 16h': d['🍽 Fasting > 16h'].checkbox,
            'Exercise': d['Exercise'].multi_select.map(x => x.name),
        });
        allExercise = allExercise.concat(d['Exercise'].multi_select.map(x => {
            return {'Exercise': x.name};
        }));
        // console.log(d)
    }
    cleanedData.sort((a, b) => a.Date - b.Date);
    cleanedData = cleanedData.map((x, i)  => {
        x["Id"] = i;
        return x;
    });
    cleanedData.reverse();
    // console.log(cleanedData.map(x => x.Date));
    // console.log(cleanedData[0].Date >= cleanedData[1].Date);


    // Write into GS
    const sheet = await doc.sheetsByIndex[0];
    // console.log(sheet.title);
    await sheet.clear();
    await sheet.setHeaderRow(['Id', 'Date', 'Weight (KG)', '👟 Workout', '🍽 Fasting > 16h']);
    await sheet.addRows(cleanedData);
    
    const sheet2 = await doc.sheetsByIndex[1];
    // console.log(sheet2.title);
    await sheet2.clear();
    await sheet2.setHeaderRow(['Exercise']);
    await sheet2.addRows(allExercise);
}

// For aws lambda
exports.handler = async (event) => {
    const start_date = new Date();
    const doc = new GoogleSpreadsheet(cred['googleSheetId']);
    await doc.useServiceAccountAuth(googleCreds);
    await doc.loadInfo();
    await syncNotion2GS(doc);
    const end_date = new Date();
    console.log(`Successful Sync! ${start_date} to ${end_date}`);
    const response = {
        statusCode: 200,
        body: JSON.stringify(`Successful Sync! ${start_date} to ${end_date}`),
    };
    return response;
};