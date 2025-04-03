# NS API Test - Train Departures/Arrivals Viewer

This project is a web application built with Next.js that displays real-time train departure and arrival information for stations in the Netherlands, utilizing the Nederlandse Spoorwegen (NS) API.

## Features

*   **Station Search:** Find stations by name.
*   **Departures/Arrivals:** Toggle between viewing departures and arrivals for the selected station.
*   **Real-time Data:** Fetches live journey information from the NS API.
*   **Time Offset:** View schedules for a future time by setting an offset.
*   **Delay Information:** Clearly indicates delayed trains and shows the actual vs. planned times.
*   **Track Information:** Displays the planned and actual platform/track number, highlighting changes.
*   **Train Composition:** Shows images and details of the train units making up a journey (where available).
*   **Disruptions & Maintenance:** Displays active disruptions and planned maintenance affecting the station or routes.
*   **Dark Mode:** Supports light and dark themes.
*   **Responsive Design:** Adapts to different screen sizes.
*   **Animations:** Uses Framer Motion for smooth transitions and animations.

## Tech Stack

*   **Framework:** [Next.js](https://nextjs.org/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components:** Custom components (previously used shadcn/ui elements)
*   **Animation:** [Framer Motion](https://www.framer.com/motion/)
*   **API:** [NS API](https://apiportal.ns.nl/) (Requires API Key)

## Getting Started

### Prerequisites

*   Node.js (Version 18.x or later recommended)
*   npm or yarn
*   An NS API Key (obtainable from the [NS API Portal](https://apiportal.ns.nl/))

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd ns-api-test
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up environment variables:**
    Create a file named `.env.local` in the root of the `ns-api-test` directory and add your NS API key:
    ```env
    NS_API_KEY=YOUR_PRIMARY_NS_API_KEY_HERE
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Deployment

This application is configured for deployment on platforms like Vercel or Netlify. Ensure your NS API key is set as an environment variable in your deployment provider's settings. A `netlify.toml` file is included for basic Netlify configuration.
