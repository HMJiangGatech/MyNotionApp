require('dotenv').config();
var fs = require('fs');
const {Client} = require("@notionhq/client");
var cred = JSON.parse(fs.readFileSync('credential.json', 'utf8'));
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

async function clickClock() {
    var allPages = await getEntriesFromDatabase(); 
    async function createNew(allPages){
        console.log("add Start Time")
        await notion.pages.create({
            parent: {
              database_id: databaseId,
            },
            properties: {
                "Start Time": {
                    type: "date",
                    date: {
                      start: new Date().toISOString(),
                    },
                },
                "Name": {
                    type: "title",
                    title: [{type: "text", text: { content: `Clock ${allPages.length}`}},],
                },
            },
        })
    }
    async function updateEndTime(pageId){
        console.log(`update End Time for ${pageId}`)
        await notion.pages.update({
            page_id: pageId,
            properties: {
                "End Time": {
                    type: "date",
                    date: {
                      start: new Date().toISOString(),
                    },
                },
            },
        })
    }
    
    if (allPages.length == 0){
        console.log("Empty")
        createNew(allPages)
    }
    else {
        console.log("Non Empty")
        allPages = allPages.map(x => {
            x.created_time = new Date(x.created_time);
            return x;
        })
        allPages.sort((a, b) => b.created_time - a.created_time);
        lastEntry = allPages[0]
        if (lastEntry.properties.hasOwnProperty("End Time"))
            createNew(allPages);
        else
            updateEndTime(lastEntry.id)
    }
}

// For aws lambda
exports.handler = async (event) => {
    const start_date = new Date();
    await clickClock();
    const end_date = new Date();
    console.log(`Successful Click! ${start_date} to ${end_date}`);
    const response = {
        statusCode: 200,
        body: JSON.stringify(`Successful Click! ${start_date} to ${end_date}`),
    };
    return response;
};

