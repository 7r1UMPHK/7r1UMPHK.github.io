import os
import sys
import time
from github import Github, GithubException

# 预设的标签名称和颜色
LABEL_COLORS = {
    "旧": "ededed",
    "Write-up": "0e8a16",
    "HackMyVM": "1d76db",
    "Challenge": "f9d0c4",
    "靶机渗透": "b60205",
}

def get_labels_from_filename(filename):
    """
    根据文件名动态识别并返回标签列表。
    """
    labels = {"旧", "Write-up"}  # 默认标签
    lower_filename = filename.lower()

    if lower_filename.startswith('hmv_'):
        labels.add("HackMyVM")
    elif lower_filename.startswith('thl_'):
        labels.add("thehackerlabs")
    elif lower_filename.startswith('vulnyx_'):
        labels.add("vulnyx")
    elif lower_filename.startswith('vulnhub_'):
        labels.add("vulnhub")
    elif lower_filename.startswith('内部_'):
        labels.add("内部靶机/maze-sec")
    elif 'challenge' in lower_filename:
        labels.add("Challenge")
    elif '靶机渗透测试' in filename:
        labels.add("靶机渗透")

    return list(labels)

def ensure_label_exists(repo, label_name, checked_labels):
    """
    确保仓库中存在指定的标签，如果不存在则创建它。
    使用 checked_labels 集合来避免重复的 API 调用。
    """
    if label_name in checked_labels:
        return

    try:
        repo.get_label(label_name)
        print(f"  - 标签 '{label_name}' 已存在。")
    except GithubException:
        print(f"  - 标签 '{label_name}' 不存在，正在创建...")
        try:
            color = LABEL_COLORS.get(label_name, "ededed")  # 获取预设颜色，如果未定义则使用默认灰色
            repo.create_label(name=label_name, color=color, description=f"关于 {label_name} 的文章")
            print(f"  - 标签 '{label_name}' 创建成功。")
        except GithubException as e:
            print(f"  - ❌ 错误：创建标签 '{label_name}' 失败。请检查 Token 权限。")
            print(f"  - GitHub API 报错: {e}")
            sys.exit(1)
    finally:
        checked_labels.add(label_name)


def main():
    """
    主函数，执行将 markdown 文件批量提交到 GitHub Issues 的逻辑。
    """
    # --- 1. 从环境变量获取凭证 ---
    try:
        token = os.environ["GITHUB_TOKEN"]
    except KeyError:
        print("错误：请设置环境变量 GITHUB_TOKEN")
        print("例如 (在 bash/zsh 中):")
        print("export GITHUB_TOKEN='你的Personal Access Token'")
        sys.exit(1)

    # --- 2. 硬编码仓库和目录信息 ---
    repo_name = "7r1UMPHK/7r1UMPHK.github.io"
    md_dir = "backup"
    print(f"目标仓库: {repo_name}")
    print(f"Markdown 文件目录: {md_dir}")

    if not os.path.isdir(md_dir):
        print(f"错误：目录 '{md_dir}' 不存在。")
        sys.exit(1)

    # --- 3. 初始化 GitHub 客户端 ---
    print("正在连接到 GitHub...")
    g = Github(token)
    try:
        repo = g.get_repo(repo_name)
        print(f"成功连接到仓库: {repo.full_name}")
    except GithubException as e:
        print(f"错误：无法访问仓库 '{repo_name}'。")
        print("请检查仓库名称是否正确，以及你的 Token 是否拥有 repo 权限。")
        print(f"GitHub API 报错: {e}")
        sys.exit(1)

    # --- 4. 查找并处理 Markdown 文件 ---
    md_files = [f for f in os.listdir(md_dir) if f.lower().endswith(".md")]
    # 按文件修改时间降序排序（最新的文件在前）
    md_files.sort(key=lambda f: os.path.getmtime(os.path.join(md_dir, f)), reverse=True)

    if not md_files:
        print(f"在目录 '{md_dir}' 中没有找到 .md 文件。")
        sys.exit(0)

    print(f"在 '{md_dir}' 中找到 {len(md_files)} 个 .md 文件。准备开始提交到 Issues...")
    
    # 获取当前用户名，用于后续的重复性检查
    current_user_login = g.get_user().login
    # 用于缓存已检查/创建的标签，避免重复 API 调用
    checked_labels = set()

    for filename in md_files:
        title = os.path.splitext(filename)[0]
        filepath = os.path.join(md_dir, filename)
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                body = f.read()
        except Exception as e:
            print(f"--- 读取文件失败: {filename} ---")
            print(f"错误: {e}")
            continue

        print(f"--- 正在处理: {filename} ---")
        print(f"  - Issue 标题: {title}")
        
        # 动态获取标签
        issue_labels = get_labels_from_filename(filename)
        print(f"  - 识别出的标签: {', '.join(issue_labels)}")
        
        try:
            # 确保所有需要的标签都存在
            for label in issue_labels:
                ensure_label_exists(repo, label, checked_labels)

            # 检查是否存在由当前用户创建的、带有 '旧' 标签的同名 issue
            # 这可以防止因脚本中断后重新运行时产生重复
            query = f'repo:{repo.full_name} is:issue is:open label:"旧" author:{current_user_login} in:title "{title}"'
            existing_issues = g.search_issues(query)
            
            if existing_issues.totalCount > 0:
                 # 精确匹配标题
                is_duplicate = any(issue.title == title for issue in existing_issues)
                if is_duplicate:
                    print(f"  - 发现已存在的同名 Issue，跳过。")
                    continue

            # 创建 Issue
            issue = repo.create_issue(
                title=title,
                body=body,
                labels=issue_labels
            )
            print(f"  - ✅ 成功创建 Issue #{issue.number}")
            
            # # 等待 30 秒
            # print("  - ⏳ 等待 30 秒...")
            # time.sleep(30)

        except GithubException as e:
            print(f"  - ❌ 创建 Issue 时发生错误: {e}")
            print("  - 可能是触发了速率限制或权限问题。脚本将等待更长时间后继续。")
            time.sleep(60)
            continue
        except Exception as e:
            print(f"  - ❌ 发生未知错误: {e}")

    print("--- 🎉 全部文件处理完毕 ---")

if __name__ == "__main__":
    main() 