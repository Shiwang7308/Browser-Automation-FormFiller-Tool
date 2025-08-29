import "dotenv/config"; 
import { Agent, run, tool } from "@openai/agents";
import { chromium } from "playwright";
import { z } from "zod";

let browser, page;

// --- Tools ---
const launchBrowser = tool({
  name: "launch_browser",
  description: "Launch a Chrome browser",
  parameters: z.object({ headless: z.boolean().default(false) }),
  async execute({ headless }) {
    browser = await chromium.launch({ headless});
    await page.waitForTimeout(1000);
    console.log("✅ Browser launched")
    return "✅ Browser launched";
  },
});

const newPage = tool({
  name: "new_page",
  description: "Open a new browser page",
  parameters: z.object({}),
  async execute() {
    page = await browser.newPage();
  },
});

const goto = tool({
  name: "goto",
  description: "Navigate to a URL and wait for DOM",
  parameters: z.object({
    url: z.string(),
    screenshotName: z.string().nullable(),
  }),
  async execute({ url, screenshotName }) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    if (screenshotName) {
      await page.screenshot({ path: `screenshots/${screenshotName}.png`, fullPage: true });
    }
    console.log(`✅ Navigated to ${url}`)
    return `✅ Navigated to ${url}`;
  },
});

const click = tool({
  name: "click",
  description: "Click an element by selector",
  parameters: z.object({
    selector: z.string(),
    screenshotName: z.string().nullable(),
  }),
  async execute({ selector, screenshotName }) {
    await page.click(selector);
    if (screenshotName) {
      await page.screenshot({ path: `${screenshotName}.png`, fullPage: true });
    }
    console.log(`✅ Clicked ${selector}`)
    return `✅ Clicked ${selector}`;
  },
});

const fill = tool({
  name: "fill",
  description: "Fill an input field realistically (like user typing)",
  parameters: z.object({
    selector: z.string(),
    value: z.string(),
    label: z.string(),
  }),
  async execute({ selector, value, label }) {
    await page.fill(selector, value);
    await page.waitForTimeout(1000);
    console.log(`✅ Filled ${label} (${selector}) with ${value}`)
    return `✅ Filled ${label} (${selector}) with ${value}`;
  },
});


const screenshot = tool({
  name: "screenshot",
  description: "Take screenshot of the current page",
  parameters: z.object({ name: z.string() }),
  async execute({ name }) {
    const path = `${name}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log(`📸 Screenshot saved: ${path}`)
    return `📸 Screenshot saved: ${path}`;
  },
});

const closeBrowser = tool({
  name: "closeBrowser",
  description: "Close the Running Browser Session",
  parameters: z.object({}),
  async execute({}){
    await browser.close();
    console.log("Broswer Closed")
  }
})
// --- Agent ---
const browserAgent = new Agent({
  name: "Browser Automation Agent",
  model: "gpt-4.1-mini",
  instructions: `
    You are a expert browser automation agent.

    ## Workflow
    1. launch_browser
    2. new_page
    3. goto { "url": "https://ui.chaicode.com"  }
    4. click { "selector": "text=Sign Up", "screenshotName": "signup-page" }
    5. Wait until URL contains "/auth/signup"
    6. Fill the signup form using fixed selectors with values given by user:
       - firstName → #firstName
       - lastName → #lastName
       - email → #email
       - password → #password
       - confirmPassword → #confirmPassword
    
    7. click { "selector": "button[type=submit]", "screenshotName": "after-submit" }
    8. Call closeBrowser Tool

    ## Rules
    - Always use the provided 'fill' tool for form filling.
    - File input to selectors placeholders based on the user query/prompt input one by one
    - Take screenshots in folder screenshots at each major step (screenshots/before-home, screenshots/home-loaded, screenshots/signup-page, screenshots/after-fill, screenshots/after-submit, screenshots/final).

    ## Final Output
    Return a JSON object:
    {
      "success": true/false,
      "usedSelectors": {
        "firstName": "$firstName",
        "lastName": "$lastName",
        "email": "$email",
        "password": "$password",
        "confirmPassword": "$confirmPassword"
      },
      "finalUrl": "<URL>",
      "message": "Signup flow executed summary"
    }
  `,
  tools: [launchBrowser, newPage, goto, click, fill, screenshot, closeBrowser],
});

// --- Run ---
async function main() {
  const userQuery = `
    Please fill below data in the sign up form
    {
      "firstName": "Shiwang",
      "lastName": "Gupta",
      "email": "test@example.com",
      "password": "Pass123!",
      "confirmPassword": "Pass123!"
    }
  `;

  const result = await run(browserAgent, userQuery, { maxTurns: 20 });

  console.log("=== Final Output ===");
  console.log(result.finalOutput);
}

main();
