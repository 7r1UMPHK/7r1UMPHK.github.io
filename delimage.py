import os
import glob

def find_unused_imgs(img_dir, post_dirs):
    exts = ["*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.ico", "*.svg"]
    imgs = []
    for e in exts:
        imgs.extend(glob.glob(os.path.join(img_dir, e)))
    if not imgs:
        print(f"未找到图片: {img_dir}")
        return []

    posts = []
    for d in post_dirs:
        if os.path.isdir(d):
            posts.extend(glob.glob(os.path.join(d, "*.html")))
            posts.extend(glob.glob(os.path.join(d, "*.json")))
            posts.extend(glob.glob(os.path.join(d, "*.js")))

    if not posts:
        print("未找到博文文件")
        print("以下图片将被视为未使用：")
        for i, p in enumerate(imgs):
            print(f"  {i+1}. {os.path.basename(p)}")
        return imgs

    content = ""
    for f in posts:
        try:
            with open(f, "r", encoding="utf-8", errors="ignore") as fp:
                content += fp.read()
        except:
            continue

    unused = []
    print("\n--- 扫描结果 ---")
    for p in imgs:
        fn = os.path.basename(p)
        if fn not in content:
            unused.append(p)
            print(f"  [未使用] {fn} ({p})")
        else:
            print(f"  [已使用] {fn}")

    if not unused:
        print("\n无未使用图片")
    return unused

if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    img_dir = os.path.join(root, "static", "image")
    post_dirs = [
        root,
        os.path.join(root, "docs", "post"),
        os.path.join(root, "docs", "plugins")
    ]

    print(f"图片路径: {img_dir}")
    print("博文路径:")
    for d in post_dirs:
        print(f"  {d}")

    go = input("\n确认开始扫描？(yes): ").strip().lower()
    if go != "yes":
        print("取消操作")
        exit()

    unused_imgs = find_unused_imgs(img_dir, post_dirs)

    if not unused_imgs:
        print("所有图片都在使用中")
        exit()

    print("\n--- 可删除列表 ---")
    for i, p in enumerate(unused_imgs):
        print(f"  {i+1}. {os.path.basename(p)}  [{p}]")

    keep_input = input("\n输入要保留的编号 (逗号/空格分隔，如 1,3 或直接回车全删): ").strip()
    keeps = set()
    if keep_input:
        try:
            nums = keep_input.replace(",", " ").split()
            for n in nums:
                idx = int(n.strip()) - 1
                if 0 <= idx < len(unused_imgs):
                    keeps.add(idx)
        except:
            print("编号格式错误，不保留额外图片")

    del_list = []
    keep_list = []
    for i, p in enumerate(unused_imgs):
        if i in keeps:
            keep_list.append(p)
        else:
            del_list.append(p)

    if keep_list:
        print("\n--- 保留列表 ---")
        for p in keep_list:
            print(f"  [保留] {os.path.basename(p)}")

    if not del_list:
        print("\n没有图片需要删除")
        exit()

    confirm = input(f"\n共 {len(del_list)} 张图片将被删除，确认？(yes): ").strip().lower()
    if confirm != "yes":
        print("取消删除")
        exit()

    cnt = 0
    print("\n--- 开始删除 ---")
    for p in del_list:
        try:
            os.remove(p)
            print(f"  已删除: {p}")
            cnt += 1
        except Exception as e:
            print(f"  删除失败: {p} ({e})")

    print(f"\n完成，共删除 {cnt} 张图片")