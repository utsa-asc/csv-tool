#!/bin/sh

list=$(ls *.png)
for img in $list; do
inname=$(convert -ping $img -format "%t" info:)
echo $inname
#convert $img -strip -colorspace RGB -resize 700x466! -background white -flatten -interlace JPEG -sampling-factor 4:2:0 -quality 75 path2/outputdirectory/${inname}.jpg
# convert $img -resize 400x500 -background white -gravity center -extent 400x500 ${inname}-400-500.jpg
## FOR ACOB
# convert $img -resize 400x500^ -background white -gravity center -extent 400x500 converted/${inname}.jpg
convert $img -density 120 -units pixelsperinch ${inname}.jpg

done

list=$(ls *.jpg)
for img in $list; do
inname=$(convert -ping $img -format "%t" info:)
echo $inname
#convert $img -strip -colorspace RGB -resize 700x466! -background white -flatten -interlace JPEG -sampling-factor 4:2:0 -quality 75 path2/outputdirectory/${inname}.jpg
# convert $img -resize 400x500 -background white -gravity center -extent 400x500 ${inname}-400-500.jpg
## FOR ACOB
convert $img -resize 400x500^ -background white -gravity center -extent 400x500 converted/${inname}.jpg
# convert $img -density 120 -units pixelsperinch ${inname}.jpg

done