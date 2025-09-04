import tkinter as tk
from tkinter import ttk, scrolledtext, filedialog, messagebox
import base64
import hashlib
import os

class TxtEncryptor:
    def __init__(self):
        self.script_header = "<!-- ##{'script':'<script src=\"https://7r1UMPHK.github.io/plugins/jiami.js\"></script>'}## -->"
    
    def encryptTxt(self, text, password):
        result = ""
        for i, char in enumerate(text):
            encrypted_char = ord(char) ^ ord(password[i % len(password)])
            result += chr(encrypted_char)
        return base64.b64encode(result.encode('utf-8')).decode()
    
    def genPostId(self, password):
        return hashlib.md5(password.encode()).hexdigest()[:8]
    
    def procTxt(self, text, password, post_id=None):
        if not post_id:
            post_id = self.genPostId(password)
        encrypted = self.encryptTxt(text, password)
        
        result = f"""{self.script_header}
<!--encrypt: {post_id}-->
<!--{encrypted}-->
<!--/encrypt-->"""
        return result, post_id

class EncryptGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("博客加密工具")
        self.root.geometry("800x650")
        self.encryptor = TxtEncryptor()
        self.setupUI()
    
    def setupUI(self):
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        
        # 密码区域
        ttk.Label(main_frame, text="密码:").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.pwd_entry = ttk.Entry(main_frame, show="*", width=30)
        self.pwd_entry.grid(row=0, column=1, sticky=(tk.W, tk.E), pady=5, padx=(10, 0))
        
        # 自定义ID区域
        ttk.Label(main_frame, text="自定义ID:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.id_entry = ttk.Entry(main_frame, width=30)
        self.id_entry.grid(row=1, column=1, sticky=(tk.W, tk.E), pady=5, padx=(10, 0))
        
        # 输入区域
        input_frame = ttk.LabelFrame(main_frame, text="输入内容", padding="5")
        input_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=10)
        input_frame.columnconfigure(0, weight=1)
        input_frame.rowconfigure(1, weight=1)
        
        # 文件选择按钮
        file_frame = ttk.Frame(input_frame)
        file_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=5)
        file_frame.columnconfigure(1, weight=1)
        
        ttk.Button(file_frame, text="选择文件", command=self.selectFile).grid(row=0, column=0, padx=(0, 10))
        self.file_label = ttk.Label(file_frame, text="未选择文件", foreground="gray")
        self.file_label.grid(row=0, column=1, sticky=tk.W)
        
        # 文本输入区
        self.input_text = scrolledtext.ScrolledText(input_frame, height=10, wrap=tk.WORD)
        self.input_text.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        # 按钮区域
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=3, column=0, columnspan=2, pady=10)
        
        ttk.Button(button_frame, text="加密", command=self.encrypt, width=12).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="清空", command=self.clearAll, width=12).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="保存结果", command=self.saveResult, width=12).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="复制结果", command=self.copyResult, width=12).pack(side=tk.LEFT, padx=5)
        
        # 结果区域
        result_frame = ttk.LabelFrame(main_frame, text="加密结果", padding="5")
        result_frame.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        result_frame.columnconfigure(0, weight=1)
        result_frame.rowconfigure(0, weight=1)
        
        self.result_text = scrolledtext.ScrolledText(result_frame, height=12, wrap=tk.WORD)
        self.result_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 状态栏
        self.status_label = ttk.Label(main_frame, text="就绪", foreground="green")
        self.status_label.grid(row=5, column=0, columnspan=2, sticky=tk.W, pady=5)
        
        # 配置权重
        main_frame.rowconfigure(2, weight=2)
        main_frame.rowconfigure(4, weight=3)
        
        self.selected_file = None
    
    def selectFile(self):
        filetypes = [
            ("所有文件", "*.*")
        ]
        self.selected_file = filedialog.askopenfilename(filetypes=filetypes)
        
        if self.selected_file:
            filename = os.path.basename(self.selected_file)
            self.file_label.config(text=f"已选择: {filename}", foreground="black")
            
            try:
                with open(self.selected_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                self.input_text.delete(1.0, tk.END)
                self.input_text.insert(1.0, content)
                self.status_label.config(text=f"已加载文件: {filename}", foreground="green")
            except UnicodeDecodeError:
                try:
                    with open(self.selected_file, 'r', encoding='gbk') as f:
                        content = f.read()
                    self.input_text.delete(1.0, tk.END)
                    self.input_text.insert(1.0, content)
                    self.status_label.config(text=f"已加载文件: {filename} (GBK编码)", foreground="green")
                except:
                    messagebox.showerror("错误", "无法读取文件，编码格式不支持")
                    self.status_label.config(text="文件加载失败", foreground="red")
        else:
            self.file_label.config(text="未选择文件", foreground="gray")
    
    def encrypt(self):
        password = self.pwd_entry.get().strip()
        if not password:
            messagebox.showerror("错误", "请输入密码")
            return
        
        input_content = self.input_text.get(1.0, tk.END).strip()
        if not input_content:
            messagebox.showerror("错误", "请输入要加密的内容")
            return
        
        try:
            custom_id = self.id_entry.get().strip() or None
            result, post_id = self.encryptor.procTxt(input_content, password, custom_id)
            
            self.result_text.delete(1.0, tk.END)
            self.result_text.insert(tk.END, result + "\n\n")
            self.result_text.insert(tk.END, "=" * 60 + "\n")
            self.result_text.insert(tk.END, f"文章ID: {post_id}\n")
            self.result_text.insert(tk.END, f"密码: {password}\n")
            self.result_text.insert(tk.END, f"原文长度: {len(input_content)} 字符\n")
            self.result_text.insert(tk.END, f"加密后长度: {len(result)} 字符")
            
            self.status_label.config(text="加密完成", foreground="green")
            messagebox.showinfo("成功", f"加密完成！\n文章ID: {post_id}")
                
        except Exception as e:
            self.status_label.config(text=f"加密失败: {str(e)}", foreground="red")
            messagebox.showerror("错误", str(e))
    
    def clearAll(self):
        self.input_text.delete(1.0, tk.END)
        self.result_text.delete(1.0, tk.END)
        self.pwd_entry.delete(0, tk.END)
        self.id_entry.delete(0, tk.END)
        self.file_label.config(text="未选择文件", foreground="gray")
        self.selected_file = None
        self.status_label.config(text="已清空", foreground="green")
    
    def copyResult(self):
        result_content = self.result_text.get(1.0, tk.END).strip()
        if not result_content:
            messagebox.showwarning("警告", "没有结果可复制")
            return
        
        # 只复制加密后的代码部分，不包含统计信息
        lines = result_content.split('\n')
        encrypt_content = []
        for line in lines:
            if line.startswith('='):
                break
            encrypt_content.append(line)
        
        copy_text = '\n'.join(encrypt_content).strip()
        
        try:
            self.root.clipboard_clear()
            self.root.clipboard_append(copy_text)
            self.status_label.config(text="已复制到剪贴板", foreground="green")
            messagebox.showinfo("成功", "加密结果已复制到剪贴板")
        except Exception as e:
            messagebox.showerror("错误", f"复制失败: {e}")
    
    def saveResult(self):
        result_content = self.result_text.get(1.0, tk.END).strip()
        if not result_content:
            messagebox.showwarning("警告", "没有结果可保存")
            return
        
        file_path = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[
                ("文本文件", "*.txt"), 
                ("Markdown文件", "*.md"),
                ("所有文件", "*.*")
            ]
        )
        
        if file_path:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(result_content)
                self.status_label.config(text=f"已保存到: {os.path.basename(file_path)}", foreground="green")
                messagebox.showinfo("成功", f"结果已保存到:\n{file_path}")
            except Exception as e:
                self.status_label.config(text="保存失败", foreground="red")
                messagebox.showerror("错误", f"保存失败: {e}")

def main():
    root = tk.Tk()
    app = EncryptGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
