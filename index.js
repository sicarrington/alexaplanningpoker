// Lambda Function code for Alexa.
// Paste this into your index.js file. 

const Alexa = require("ask-sdk");
const https = require("https");



const invocationName = "planning poker";

// Session Attributes 
//   Alexa will track attributes for you, by default only during the lifespan of your session.
//   The history[] array will track previous request(s), used for contextual Help/Yes/No handling.
//   Set up DynamoDB persistence to have the skill save and reload these attributes between skill sessions.

function getMemoryAttributes() {
    const memoryAttributes = {
        "history": [],

        // The remaining attributes will be useful after DynamoDB persistence is configured
        "launchCount": 0,
        "lastUseTimestamp": 0,

        "lastSpeechOutput": {},
        "nextIntent": []

        // "favoriteColor":"",
        // "name":"",
        // "namePronounce":"",
        // "email":"",
        // "mobileNumber":"",
        // "city":"",
        // "state":"",
        // "postcode":"",
        // "birthday":"",
        // "bookmark":0,
        // "wishlist":[],
    };
    return memoryAttributes;
};

const maxHistorySize = 20; // remember only latest 20 intents 


function getPlanningPokerStatus(sessionId, callback, errorCallback) {

    const planningPokerAPI = {
        host: process.env.API_HOST,
        port: 443,
        path: `/api/Sessions/${sessionId}`,
        method: 'GET',
        headers: { 'user-key': process.env.API_KEY },
    };

    //callback(sessionId);
    const req = https.request(planningPokerAPI, (res) => {
        res.setEncoding('utf8');
        let returnData = '';

        res.on('data', (chunk) => {
            returnData += chunk;
        });
        res.on('end', () => {
            console.log("Ending request");
            console.log("Ending request - " + returnData);
            if (returnData.length > 0) {
                let retData = JSON.parse(returnData);
                console.log("json parsed");
                callback(retData);
            } else {
                errorCallback(null);
            }
        });
    });
    req.on('error', (e) => {
        console.log("Error callback");
        errorCallback(e);
    });
    req.end();
}

// 1. Intent Handlers =============================================

const AMAZON_CancelIntent_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.CancelIntent';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();


        let say = 'Okay, talk to you later! ';

        return responseBuilder
            .speak(say)
            .withShouldEndSession(true)
            .getResponse();
    },
};

const AMAZON_HelpIntent_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let intents = getCustomIntents();
        let sampleIntent = randomElement(intents);

        let say = 'You asked for help. ';

        // let previousIntent = getPreviousIntent(sessionAttributes);
        // if (previousIntent && !handlerInput.requestEnvelope.session.new) {
        //     say += 'Your last intent was ' + previousIntent + '. ';
        // }
        // say +=  'I understand  ' + intents.length + ' intents, '

        say += ' Here something you can ask me, ' + getSampleUtterance(sampleIntent);

        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

const AMAZON_StopIntent_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.StopIntent';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();


        let say = 'Okay, talk to you later! ';

        return responseBuilder
            .speak(say)
            .withShouldEndSession(true)
            .getResponse();
    },
};

const sessionstatus_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'sessionstatus';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        // delegate to Alexa to collect all the required slots 
        const currentIntent = request.intent;
        if (request.dialogState && request.dialogState !== 'COMPLETED') {
            return handlerInput.responseBuilder
                .addDelegateDirective(currentIntent)
                .getResponse();

        }

        let sessionid = null;
        if (request.intent.slots.sessionid &&
            request.intent.slots.sessionid.value &&
            request.intent.slots.sessionid.value !== '?'
        ) {
            sessionid = request.intent.slots.sessionid;

        } else {
            sessionid = null;
        }

        return new Promise((resolve) => {
            let wibble = resolve;
            let resp = handlerInput.responseBuilder;
            getPlanningPokerStatus(sessionid.value, (data) => {
                if (data == null) {
                    resolve(handlerInput.responseBuilder.speak("There was a problem getting the information. Please try again later").withStandardCard('Planning Poker', "data was empty").getResponse());
                }

                let votingParticipants = data.participants.filter(function (a) {
                    if (!a.isObserver) return a;
                });
                let votedVotingParticipants = votingParticipants.filter(function (a) {
                    if (a.currentVote != 0) return a;
                });

                let speachOutput = `There are ${votingParticipants.length} voters. `;
                let textOutput = "";
                if (votedVotingParticipants.length == 0) {
                    speachOutput += `Noone has voted yet`;
                } else if (votingParticipants.length > votedVotingParticipants.length) {
                    speachOutput += `${votedVotingParticipants.length} ${votedVotingParticipants.length > 1 ? "people have" : "person has"} voted, the results will be revealed once everyone has voted`;
                } else if (votingParticipants.length == votedVotingParticipants.length) {

                    let allVotesEqual = true;
                    var voteReference = votingParticipants[0].currentVote;
                    for (let index = 0; index < votingParticipants.length; ++index) {
                        if (voteReference != votingParticipants[index].currentVote) {
                            allVotesEqual = false;
                        }
                    }
                    if (allVotesEqual == true) {
                        speachOutput = `Voting has finished and everyone agreed! The agreed size is ${votingParticipants[0].currentVoteDescription}`;
                        textOutput = `Voting complete - agreed size ${votingParticipants[0].currentVoteDescription}`;
                    } else {
                        speachOutput += "Voting is complete! Not everyone agreed. ";
                        for (let index = 0; index < votingParticipants.length; ++index) {
                            speachOutput += `${votingParticipants[index].name} voted ${votingParticipants[index].currentVoteDescription}. `;
                        }
                    }
                }

                if (textOutput === "") {
                    for (let index = 0; index < votingParticipants.length; ++index) {
                        textOutput += `${votingParticipants[index].name} - ${votingParticipants[index].currentVoteDescription}\n`;
                    }
                }

                var responseMessage =
                    responseBuilder.speak(speachOutput)
                        .withStandardCard('Planning poker',
                            textOutput)
                        .getResponse();

                console.log("ResponseSentt", responseMessage);

                return resolve(
                    responseMessage
                );
            },
                (error) => {

                }
            );
        });
    },
};

const LaunchRequest_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        const responseBuilder = handlerInput.responseBuilder;

        let say = 'Welcome to planning poker. Say help to hear some options';

        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            // .withStandardCard('Welcome!', 
            //   'Hello!\nThis is a card for your skill, ' ,
            //   welcomeCardImg.smallImageUrl, welcomeCardImg.largeImageUrl)
            .getResponse();
    },
};

const SessionEndedHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const request = handlerInput.requestEnvelope.request;

        console.log(`Error handled: ${error.message}`);
        // console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);

        return handlerInput.responseBuilder
            .speak('Sorry, an error occurred.  Please say again.')
            .reprompt('Sorry, an error occurred.  Please say again.')
            .getResponse();
    }
};


// 2. Constants ===========================================================================

// Here you can define static data, to be used elsewhere in your code.  For example: 
//    const myString = "Hello World";
//    const myArray  = [ "orange", "grape", "strawberry" ];
//    const myObject = { "city": "Boston",  "state":"Massachusetts" };

const APP_ID = undefined;  // TODO replace with your Skill ID (OPTIONAL).

// 3.  Helper Functions ===================================================================

function capitalize(myString) {

    return myString.replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
}


function randomElement(myArray) {
    return (myArray[Math.floor(Math.random() * myArray.length)]);
}

function stripSpeak(str) {
    return (str.replace('<speak>', '').replace('</speak>', ''));
}




function getSlotValues(filledSlots) {
    const slotValues = {};

    Object.keys(filledSlots).forEach((item) => {
        const name = filledSlots[item].name;

        if (filledSlots[item] &&
            filledSlots[item].resolutions &&
            filledSlots[item].resolutions.resolutionsPerAuthority[0] &&
            filledSlots[item].resolutions.resolutionsPerAuthority[0].status &&
            filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
            switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
                case 'ER_SUCCESS_MATCH':
                    slotValues[name] = {
                        heardAs: filledSlots[item].value,
                        resolved: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name,
                        ERstatus: 'ER_SUCCESS_MATCH'
                    };
                    break;
                case 'ER_SUCCESS_NO_MATCH':
                    slotValues[name] = {
                        heardAs: filledSlots[item].value,
                        resolved: '',
                        ERstatus: 'ER_SUCCESS_NO_MATCH'
                    };
                    break;
                default:
                    break;
            }
        } else {
            slotValues[name] = {
                heardAs: filledSlots[item].value,
                resolved: '',
                ERstatus: ''
            };
        }
    }, this);

    return slotValues;
}

function getExampleSlotValues(intentName, slotName) {

    let examples = [];
    let slotType = '';
    let slotValuesFull = [];

    let intents = model.interactionModel.languageModel.intents;
    for (let i = 0; i < intents.length; i++) {
        if (intents[i].name == intentName) {
            let slots = intents[i].slots;
            for (let j = 0; j < slots.length; j++) {
                if (slots[j].name === slotName) {
                    slotType = slots[j].type;

                }
            }
        }

    }
    let types = model.interactionModel.languageModel.types;
    for (let i = 0; i < types.length; i++) {
        if (types[i].name === slotType) {
            slotValuesFull = types[i].values;
        }
    }


    examples.push(slotValuesFull[0].name.value);
    examples.push(slotValuesFull[1].name.value);
    if (slotValuesFull.length > 2) {
        examples.push(slotValuesFull[2].name.value);
    }


    return examples;
}

function sayArray(myData, penultimateWord = 'and') {
    let result = '';

    myData.forEach(function (element, index, arr) {

        if (index === 0) {
            result = element;
        } else if (index === myData.length - 1) {
            result += ` ${penultimateWord} ${element}`;
        } else {
            result += `, ${element}`;
        }
    });
    return result;
}
function supportsDisplay(handlerInput) // returns true if the skill is running on a device with a display (Echo Show, Echo Spot, etc.) 
{                                      //  Enable your skill for display as shown here: https://alexa.design/enabledisplay 
    const hasDisplay =
        handlerInput.requestEnvelope.context &&
        handlerInput.requestEnvelope.context.System &&
        handlerInput.requestEnvelope.context.System.device &&
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display;

    return hasDisplay;
}


const welcomeCardImg = {
    smallImageUrl: "https://s3.amazonaws.com/skill-images-789/cards/card_plane720_480.png",
    largeImageUrl: "https://s3.amazonaws.com/skill-images-789/cards/card_plane1200_800.png"


};

const DisplayImg1 = {
    title: 'Jet Plane',
    url: 'https://s3.amazonaws.com/skill-images-789/display/plane340_340.png'
};
const DisplayImg2 = {
    title: 'Starry Sky',
    url: 'https://s3.amazonaws.com/skill-images-789/display/background1024_600.png'

};

function getCustomIntents() {
    const modelIntents = model.interactionModel.languageModel.intents;

    let customIntents = [];


    for (let i = 0; i < modelIntents.length; i++) {

        if (modelIntents[i].name.substring(0, 7) != "AMAZON." && modelIntents[i].name !== "LaunchRequest") {
            customIntents.push(modelIntents[i]);
        }
    }
    return customIntents;
}

function getSampleUtterance(intent) {

    return randomElement(intent.samples);

}

function getPreviousIntent(attrs) {

    if (attrs.history && attrs.history.length > 1) {
        return attrs.history[attrs.history.length - 2].IntentRequest;

    } else {
        return false;
    }

}

function getPreviousSpeechOutput(attrs) {

    if (attrs.lastSpeechOutput && attrs.history.length > 1) {
        return attrs.lastSpeechOutput;

    } else {
        return false;
    }

}

function timeDelta(t1, t2) {

    const dt1 = new Date(t1);
    const dt2 = new Date(t2);
    const timeSpanMS = dt2.getTime() - dt1.getTime();
    const span = {
        "timeSpanMIN": Math.floor(timeSpanMS / (1000 * 60)),
        "timeSpanHR": Math.floor(timeSpanMS / (1000 * 60 * 60)),
        "timeSpanDAY": Math.floor(timeSpanMS / (1000 * 60 * 60 * 24)),
        "timeSpanDesc": ""
    };


    if (span.timeSpanHR < 2) {
        span.timeSpanDesc = span.timeSpanMIN + " minutes";
    } else if (span.timeSpanDAY < 2) {
        span.timeSpanDesc = span.timeSpanHR + " hours";
    } else {
        span.timeSpanDesc = span.timeSpanDAY + " days";
    }


    return span;

}


const InitMemoryAttributesInterceptor = {
    process(handlerInput) {
        let sessionAttributes = {};
        if (handlerInput.requestEnvelope.session['new']) {

            sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            let memoryAttributes = getMemoryAttributes();

            if (Object.keys(sessionAttributes).length === 0) {

                Object.keys(memoryAttributes).forEach(function (key) {  // initialize all attributes from global list 

                    sessionAttributes[key] = memoryAttributes[key];

                });

            }
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);


        }
    }
};

const RequestHistoryInterceptor = {
    process(handlerInput) {

        const thisRequest = handlerInput.requestEnvelope.request;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let history = sessionAttributes['history'] || [];

        let IntentRequest = {};
        if (thisRequest.type === 'IntentRequest') {

            let slots = [];

            IntentRequest = {
                'IntentRequest': thisRequest.intent.name
            };

            if (thisRequest.intent.slots) {

                for (let slot in thisRequest.intent.slots) {
                    let slotObj = {};
                    slotObj[slot] = thisRequest.intent.slots[slot].value;
                    slots.push(slotObj);
                }

                IntentRequest = {
                    'IntentRequest': thisRequest.intent.name,
                    'slots': slots
                };

            }

        } else {
            IntentRequest = { 'IntentRequest': thisRequest.type };
        }
        if (history.length > maxHistorySize - 1) {
            history.shift();
        }
        history.push(IntentRequest);

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    }

};




const RequestPersistenceInterceptor = {
    process(handlerInput) {

        if (handlerInput.requestEnvelope.session['new']) {

            return new Promise((resolve, reject) => {

                handlerInput.attributesManager.getPersistentAttributes()

                    .then((sessionAttributes) => {
                        sessionAttributes = sessionAttributes || {};


                        sessionAttributes['launchCount'] += 1;

                        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

                        handlerInput.attributesManager.savePersistentAttributes()
                            .then(() => {
                                resolve();
                            })
                            .catch((err) => {
                                reject(err);
                            });
                    });

            });

        } // end session['new'] 
    }
};


const ResponseRecordSpeechOutputInterceptor = {
    process(handlerInput, responseOutput) {

        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let lastSpeechOutput = {
            "outputSpeech": responseOutput.outputSpeech.ssml,
            "reprompt": responseOutput.reprompt.outputSpeech.ssml
        };

        sessionAttributes['lastSpeechOutput'] = lastSpeechOutput;

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    }
};

const ResponsePersistenceInterceptor = {
    process(handlerInput, responseOutput) {

        const ses = (typeof responseOutput.shouldEndSession == "undefined" ? true : responseOutput.shouldEndSession);

        if (ses || handlerInput.requestEnvelope.request.type == 'SessionEndedRequest') { // skill was stopped or timed out 

            let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            sessionAttributes['lastUseTimestamp'] = new Date(handlerInput.requestEnvelope.request.timestamp).getTime();

            handlerInput.attributesManager.setPersistentAttributes(sessionAttributes);

            return new Promise((resolve, reject) => {
                handlerInput.attributesManager.savePersistentAttributes()
                    .then(() => {
                        resolve();
                    })
                    .catch((err) => {
                        reject(err);
                    });

            });

        }

    }
};



// 4. Exports handler function and setup ===================================================
const skillBuilder = Alexa.SkillBuilders.standard();
exports.handler = skillBuilder
    .addRequestHandlers(
        AMAZON_CancelIntent_Handler,
        AMAZON_HelpIntent_Handler,
        AMAZON_StopIntent_Handler,
        sessionstatus_Handler,
        LaunchRequest_Handler,
        SessionEndedHandler
    )
    .addErrorHandlers(ErrorHandler)
    .addRequestInterceptors(InitMemoryAttributesInterceptor)
    .addRequestInterceptors(RequestHistoryInterceptor)

    // .addResponseInterceptors(ResponseRecordSpeechOutputInterceptor)

    // .addRequestInterceptors(RequestPersistenceInterceptor)
    // .addResponseInterceptors(ResponsePersistenceInterceptor)

    // .withTableName("askMemorySkillTable")
    // .withAutoCreateTable(true)

    .lambda();


// End of Skill code -------------------------------------------------------------
// Static Language Model for reference

const model = {
    "interactionModel": {
        "languageModel": {
            "invocationName": "planning poker",
            "intents": [
                {
                    "name": "AMAZON.CancelIntent",
                    "samples": []
                },
                {
                    "name": "AMAZON.HelpIntent",
                    "samples": []
                },
                {
                    "name": "AMAZON.StopIntent",
                    "samples": []
                },
                {
                    "name": "sessionstatus",
                    "slots": [
                        {
                            "name": "sessionid",
                            "type": "AMAZON.NUMBER",
                            "samples": [
                                "{sessionid}",
                                "the session with i.d. {sessionid}",
                                "session {sessionid}"
                            ]
                        }
                    ],
                    "samples": [
                        "tell me the result for session {sessionid}",
                        "tell me the result of session {sessionid}",
                        "announce the result for session {sessionid}",
                        "what is the status of planning poker {sessionid}",
                        "what is the status of planning {sessionid}",
                        "what is the status of the session {sessionid}",
                        "get the status of {sessionid}",
                        "what are the votes in {sessionid}",
                        "whats happening in session {sessionid}"
                    ]
                },
                {
                    "name": "LaunchRequest"
                }
            ],
            "types": []
        },
        "dialog": {
            "intents": [
                {
                    "name": "sessionstatus",
                    "confirmationRequired": false,
                    "prompts": {},
                    "slots": [
                        {
                            "name": "sessionid",
                            "type": "AMAZON.NUMBER",
                            "confirmationRequired": false,
                            "elicitationRequired": true,
                            "prompts": {
                                "elicitation": "Elicit.Slot.401309391180.965202171218"
                            }
                        }
                    ]
                }
            ]
        },
        "prompts": [
            {
                "id": "Elicit.Slot.401309391180.965202171218",
                "variations": [
                    {
                        "type": "PlainText",
                        "value": "which session can I help you with?"
                    },
                    {
                        "type": "PlainText",
                        "value": "which session would you like to hear about"
                    },
                    {
                        "type": "PlainText",
                        "value": "what is the id of the session"
                    }
                ]
            }
        ]
    }
};
