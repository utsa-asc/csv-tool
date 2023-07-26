#!/bin/sh

list=$(ls *.png)
for img in $list; do
inname=$(convert -ping $img -format "%t" info:)
echo $inname
#convert $img -strip -colorspace RGB -resize 700x466! -background white -flatten -interlace JPEG -sampling-factor 4:2:0 -quality 75 path2/outputdirectory/${inname}.jpg
#convert $img -resize 350x175 -background white -gravity center -extent 350x175 ${inname}-350.jpg
convert $img -density 120 -units pixelsperinch ${inname}.jpg

done