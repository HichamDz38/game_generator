from PIL import Image, ImageDraw, ImageFont
import subprocess
import os
import numpy as np
import pygame
import time
import itertools

def get_screen_resolution():
    # Use fbset to get resolution from framebuffer
    try:
        output = os.popen("fbset -s | grep geometry").read()
        _, w, h, *_ = output.split()
        return int(w), int(h)
    except:
        #  if fbset is missing
        print("fbset is missing")
        return 800, 480


def rgb888_to_rgb565(img):
    """Convert PIL RGB image to RGB565 byte array"""
    arr = np.array(img, dtype=np.uint8)
    r = (arr[:,:,0] >> 3).astype(np.uint16)
    g = (arr[:,:,1] >> 2).astype(np.uint16)
    b = (arr[:,:,2] >> 3).astype(np.uint16)
    rgb565 = (r << 11) | (g << 5) | b
    return rgb565.astype("<u2").tobytes()  # little-endian 16-bit


def main(img_path, text_to_insert):
    img = Image.open(img_path)
    screen_w, screen_h = get_screen_resolution()
    # Resize to fullscreen
    img = img.convert("RGB").resize((screen_w, screen_h))
    draw = ImageDraw.Draw(img)

    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 140)
    draw.text((250, 700), text_to_insert, (250, 20, 100), font=font)
    # save the image temporarly 
    img.save("tmp.png")

    
    final_path = "/tmp/final_splash.png"
    img.save(final_path)
    # Kill any fbi instance to avoid conflicts
    # Show it using fbi
    subprocess.run(["sudo", "killall", "fbi"], stderr=subprocess.DEVNULL)
    subprocess.run(["sudo", "fbi", "-T", "1", "/dev/fb0" , "-a", "--noverbose", "tmp.png"])



def show(img_path,text_to_insert):
    screen_w, screen_h = get_screen_resolution()
    img = Image.open(img_path).convert("RGB")
    img = img.resize((screen_w, screen_h))  # set to your screen resolution

    draw = ImageDraw.Draw(img) # draw the image to variable
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 160)
    # Get text size
    text_w, text_h = draw.textsize(text_to_insert, font=font)
    #text position
    x, y = 250, 700
    padding = 20  # padding around text
    draw.rectangle(
        [x - padding, y - padding, x + text_w + padding, y + text_h + padding],
        fill=(0, 0, 0) # black
    )
    draw.text((250, 700), text_to_insert, (250, 20, 100), font=font)
    # Convert to correct pixel format for framebuffer
    # (most Raspberry Pi screens use 16-bit RGB565)
    fb_bytes = rgb888_to_rgb565(img)
    with open("/dev/fb0", "wb") as f:
        f.write(fb_bytes)

def cast(img_path,text_to_insert):

    pygame.init()

    # Open fullscreen window
    screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
    pygame.mouse.set_visible(False)

    # Font for overlay text
    font = pygame.font.SysFont("DejaVuSans", 200)
    def show_image(path, overlay_text):
        # Load image
        img = pygame.image.load(path)
        img = pygame.transform.scale(img, screen.get_size())  # fit screen

        # Draw image
        screen.blit(img, (0, 0))

        # Draw text overlay (white text, black background)
        if overlay_text:
            text_surface = font.render(overlay_text, True, (255, 255, 255), (0, 0, 0))
            text_rect = text_surface.get_rect(bottomright=(screen.get_width() - 20, screen.get_height() - 20))
            screen.blit(text_surface, text_rect)

        # Update display
        pygame.display.update()
    
    show_image(img_path,text_to_insert)



if __name__ == "__main__":
    main()

# i provided 3 functions cast , show , and main 
# main is not fast and relay on the fbi
#show is fast and lightwight but does not support many features
# cast is good because ther is many possibilities like animations and text rendring
# choose one 