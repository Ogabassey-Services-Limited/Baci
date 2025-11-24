import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BUCKET_NAME = 'media';

export async function GET(request: Request) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!merchant) {
        return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // List files from Supabase Storage
    const merchantFolder = `${merchant.id}/`;

    const { data: files, error: listError } = await supabase
        .storage
        .from(BUCKET_NAME)
        .list(merchantFolder, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'created_at', order: 'desc' }
        });

    if (listError) {
        console.error('Error listing files:', listError);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }

    // Get public URLs for all files
    const filesWithUrls = files.map(file => {
        const { data: urlData } = supabase
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(`${merchantFolder}${file.name}`);

        return {
            id: file.id,
            name: file.name,
            url: urlData.publicUrl,
            size: file.metadata?.size || 0,
            type: file.metadata?.mimetype || 'image/*',
            createdAt: file.created_at || new Date().toISOString(),
        };
    });

    return NextResponse.json({ files: filesWithUrls });
}

export async function POST(request: Request) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!merchant) {
        return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Only images are allowed' }, { status: 400 });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const ext = file.name.split('.').pop();
        const fileName = `${timestamp}-${randomStr}.${ext}`;
        const filePath = `${merchant.id}/${fileName}`;

        // Convert File to ArrayBuffer then to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage
        const { data, error } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Upload error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Get public URL
        const { data: urlData } = supabase
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        return NextResponse.json({
            success: true,
            file: {
                id: data.id || fileName,
                name: fileName,
                url: urlData.publicUrl,
                size: file.size,
                type: file.type,
                createdAt: new Date().toISOString(),
            }
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
        return NextResponse.json({ error: 'File ID required' }, { status: 400 });
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!merchant) {
        return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Delete file from Supabase Storage
    const filePath = `${merchant.id}/${fileId}`;

    const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .remove([filePath]);

    if (error) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
