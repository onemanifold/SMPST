from playwright.sync_api import sync_playwright, expect
import os

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get the absolute path to the index.html file
        absolute_path = os.path.abspath('index.html')

        # Use the file:// protocol to open the local file
        page.goto(f'file://{absolute_path}')

        # Verify that the main components of the IDE are visible
        expect(page.get_by_role("heading", name="Secure Scribble IDE")).to_be_visible()
        expect(page.get_by_text("Test Suite Status")).to_be_visible()
        expect(page.get_by_text("Protocol Editor")).to_be_visible()
        expect(page.get_by_text("Role Projections")).to_be_visible()

        # Wait for the "Failed Tests" section to appear
        expect(page.get_by_role("heading", name="Failed Tests")).to_be_visible(timeout=10000)

        # Take a screenshot of the entire page
        page.screenshot(path="jules-scratch/verification/verification.png")

        browser.close()

if __name__ == "__main__":
    main()
