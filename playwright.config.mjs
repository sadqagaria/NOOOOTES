import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: { timeout: 12000 },
  reporter: [['list'],['html',{open:'never',outputFolder:'playwright-report'}]],
  fullyParallel:false,
  retries:0,
  maxFailures:1,
  use: {
    baseURL:'http://127.0.0.1:4173',
    browserName:'chromium',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    permissions:['microphone'],
    launchOptions: { args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] }
  },
  projects:[
    {name:'android-sized',use:{...devices['Pixel 7'],browserName:'chromium'}},
    {name:'desktop',use:{viewport:{width:1366,height:900},browserName:'chromium'}}
  ],
  webServer:{
    command:'python3 -m http.server 4173 --directory www --bind 127.0.0.1',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:!process.env.CI,
    timeout:30000
  }
});
