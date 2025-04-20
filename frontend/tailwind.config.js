/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}", // Include all files in src
        "./src/pages/**/*.{js,jsx,ts,tsx}", // Include files in pages
        "./src/hooks/**/*.{js,jsx,ts,tsx}" // Include files in hooks
    ],
    theme: {
        extend: {
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in', // For image and card fade-in
                'slide-up': 'slideUp 0.5s ease-out', // For cart and section slide-up
                // 'pulse' and 'bounce' are included in Tailwind's default animations
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
            colors: {
                // Optional: Custom color for branding consistency
                'teenverse-indigo': {
                    600: '#4f46e5', // Matches Tailwind's indigo-600
                },
            },
        },
    },
    plugins: [],
};