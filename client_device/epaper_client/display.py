from IT8951.display import AutoEPDDisplay
from IT8951 import constants
from PIL import Image

def main(image_path):

    # Init display (using spidev, no GPIO base needed)
    epd = AutoEPDDisplay(vcom=-1.45)

    # Load and convert image
    img = Image.open(image_path).convert("L").resize((epd.width, epd.height))

    # Draw grayscale image
    epd.frame_buf.paste(img, (0, 0))
    epd.draw_full(constants.DisplayModes.GC16)

    # Fast B/W mode test
    bw_img = img.convert("1")
    epd.frame_buf.paste(bw_img, (0, 0))
    epd.draw_full(constants.DisplayModes.A2)

if __name__ == "__main__":
    main()
